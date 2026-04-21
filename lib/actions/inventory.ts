"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// --- FETCH INVENTORY SUMMARY ---
export async function getInventoryAction() {
  const { data, error } = await supabaseAdmin
    .from('inventory_items')
    .select('*')
    .order('name', { ascending: true });

  if (error) return { error: error.message };
  return { data };
}

// --- ADD NEW SKU ---
export async function createSkuAction(formData: any) {
  const { sku, name, category, lowStockThreshold, sellingPrice, cost, imageUrl } = formData;

  const { error } = await supabaseAdmin
    .from('inventory_items')
    .insert([{ 
      sku, 
      name, 
      category, 
      low_stock_threshold: parseInt(lowStockThreshold),
      selling_price: parseFloat(sellingPrice) || 0,
      cost: parseFloat(cost) || 0,
      image_url: imageUrl || null,
      current_quantity: 0 
    }]);

  if (error) return { error: error.message };
  
  revalidatePath('/inventory');
  return { success: true };
}

// --- ADJUST STOCK (IN / OUT / PULL_OUT) ---
export async function adjustStockAction(formData: any) {
  const { skuId, type, quantity, expiryDate, notes, userId } = formData;
  const qty = parseInt(quantity);
  
  // 1. Get the current item to calculate the new total
  const { data: item, error: itemError } = await supabaseAdmin
    .from('inventory_items')
    .select('current_quantity')
    .eq('id', skuId)
    .single();
    
  if (itemError) return { error: itemError.message };

  // 2. Calculate new total (Stock In adds, Stock Out/Pull Out subtracts)
  const isAdding = type === 'IN' || type === 'INITIAL';
  const newTotal = isAdding ? item.current_quantity + qty : item.current_quantity - qty;

  if (newTotal < 0) {
    return { error: "Insufficient stock for this transaction." };
  }

  // 3. Log the transaction
  const { error: txError } = await supabaseAdmin
    .from('inventory_transactions')
    .insert([{
      sku_id: skuId,
      transaction_type: type,
      quantity_changed: isAdding ? qty : -qty,
      expiry_date: expiryDate || null,
      notes,
      user_id: userId
    }]);

  if (txError) return { error: txError.message };

  // 4. Update the master quantity
  const { error: updateError } = await supabaseAdmin
    .from('inventory_items')
    .update({ current_quantity: newTotal })
    .eq('id', skuId);

  if (updateError) return { error: updateError.message };

  revalidatePath('/inventory');
  return { success: true };
}

// --- FETCH EXPIRING BATCHES (< 6 MONTHS) ---
export async function getExpiringBatchesAction() {
  // 1. Get all 'IN' transactions that have an expiry date
  const { data: batches, error } = await supabaseAdmin
    .from('inventory_transactions')
    .select(`
      id,
      quantity_changed,
      created_at,
      expiry_date,
      sku_id,
      inventory_items ( sku, name )
    `)
    .eq('transaction_type', 'IN')
    .not('expiry_date', 'is', null);

  if (error) return { error: error.message };
  if (!batches || batches.length === 0) return { data: [] };

  // 2. Filter for batches expiring in the next 180 days
  const today = new Date();
  const sixMonthsFromNow = new Date();
  sixMonthsFromNow.setDate(today.getDate() + 180);

  const expiringBatches = batches.filter(batch => {
    const expDate = new Date(batch.expiry_date);
    return expDate >= today && expDate <= sixMonthsFromNow;
  });

  // 3. FIFO Logic to see if the batch still has stock
  const finalExpiringList = [];

  for (const batch of expiringBatches) {
    const { data: outTxs } = await supabaseAdmin
      .from('inventory_transactions')
      .select('quantity_changed')
      .eq('sku_id', batch.sku_id)
      .in('transaction_type', ['OUT', 'PULL_OUT']);

    const totalPulledOut = outTxs ? outTxs.reduce((sum, tx) => sum + Math.abs(tx.quantity_changed), 0) : 0;

    const { data: olderInTxs } = await supabaseAdmin
      .from('inventory_transactions')
      .select('quantity_changed')
      .eq('sku_id', batch.sku_id)
      .eq('transaction_type', 'IN')
      .lt('created_at', batch.created_at);
      
    const totalOlderStock = olderInTxs ? olderInTxs.reduce((sum, tx) => sum + tx.quantity_changed, 0) : 0;

    const amountEatenFromThisBatch = Math.max(0, totalPulledOut - totalOlderStock);
    const remainingInBatch = Math.max(0, batch.quantity_changed - amountEatenFromThisBatch);

    // @ts-ignore - Supabase join typing workaround
    if (remainingInBatch > 0) {
      finalExpiringList.push({
        id: batch.id,
        // @ts-ignore
        sku: batch.inventory_items.sku,
        // @ts-ignore
        name: batch.inventory_items.name,
        expiryDate: batch.expiry_date,
        remainingQty: remainingInBatch
      });
    }
  }

  finalExpiringList.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  return { data: finalExpiringList };
}

// --- FETCH SKU TRANSACTION HISTORY ---
export async function getSkuHistoryAction(skuId: string) {
  const { data, error } = await supabaseAdmin
    .from('inventory_transactions')
    .select('*')
    .eq('sku_id', skuId)
    .order('created_at', { ascending: false });

  if (error) return { error: error.message };
  return { data };
}

// Paste this at the very bottom of: lib/actions/inventory.ts

export async function bulkImportSkusAction(newItems: any[], initialStockData: any[]) {
  try {
    // 1. Securely insert the items using the Master Key
    const { data: insertedItems, error } = await supabaseAdmin
      .from('inventory_items')
      .insert(newItems)
      .select();

    if (error) {
      if (error.code === '23505') throw new Error("Duplicate SKU detected! Ensure all SKUs are unique.");
      throw error;
    }

    // 2. Securely log the initial stock into the transaction ledger
    const transactions = [];
    if (insertedItems) {
      for (const item of insertedItems) {
        const stockInfo = initialStockData.find((s: any) => s.sku === item.sku);
        if (stockInfo && stockInfo.quantity > 0) {
          transactions.push({
            sku_id: item.id,
            transaction_type: 'INITIAL',
            quantity_changed: stockInfo.quantity,
            notes: 'Initial Bulk CSV Import',
            expiry_date: stockInfo.expiryDate || null
          });
        }
      }
    }

    if (transactions.length > 0) {
      const { error: txError } = await supabaseAdmin.from('inventory_transactions').insert(transactions);
      if (txError) throw txError;
    }

    revalidatePath('/inventory');
    return { success: true, count: newItems.length };
  } catch (error: any) {
    return { error: error.message };
  }
}