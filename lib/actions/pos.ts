"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getNextOrderNumberAction() {
  const { data } = await supabaseAdmin
    .from('orders')
    .select('receipt_number')
    .order('created_at', { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (data && data.length > 0 && data[0].receipt_number) {
    const currentNum = parseInt(data[0].receipt_number.replace('PSL-', ''), 10);
    if (!isNaN(currentNum)) nextNum = currentNum + 1;
  }
  
  return `PSL-${String(nextNum).padStart(5, '0')}`;
}

export async function processCheckoutAction(payload: any) {
  try {
    const receiptNumber = await getNextOrderNumberAction();

    // Safely extract Customer ID 
    const customerId = payload.customerId || payload.customer?.id || null;

    // 1. Create the Main Order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert([{
        receipt_number: receiptNumber,
        customer_id: customerId && customerId !== 'Walk-In' ? customerId : null,
        cashier_name: payload.cashierName || payload.cashier?.name || 'Staff',
        subtotal: Number(payload.subtotal || 0),
        discount_type: payload.discountType || null,
        discount_value: Number(payload.discountValue || 0),
        discount_amount: Number(payload.discountAmount || 0),
        discount_id_number: payload.discountID || null,
        grand_total: Number(payload.grandTotal || 0),
        payment_method: payload.paymentMethod || 'CASH',
        payment_provider: payload.paymentProvider || null,
        reference_number: payload.referenceNumber || null
      }])
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItems = [];
    const inventoryTransactions = [];

    // 2. Process Cart Items (Perfectly synced to POS frontend)
    for (const item of payload.cart) {
      const itemPrice = Number(item.selling_price || item.price || 0);
      const quantity = Number(item.quantity || 1);
      
      // The POS frontend passes the exact inventory item ID
      const itemId = item.id; 

      if (!itemId) continue; // Skip corrupted items

      orderItems.push({
        order_id: order.id,
        sku_id: itemId,
        quantity: quantity,
        price_at_time: itemPrice,
        total_price: itemPrice * quantity
      });

      const category = item.category || "";
      const isService = category.includes("Service") || category.includes("Treatment") || category === "Packages";
      
      if (!isService) {
         const { data: currentItem } = await supabaseAdmin
           .from('inventory_items')
           .select('current_quantity')
           .eq('id', itemId)
           .single();
           
         if (currentItem) {
           await supabaseAdmin
             .from('inventory_items')
             .update({ current_quantity: currentItem.current_quantity - quantity })
             .eq('id', itemId);
         }

         inventoryTransactions.push({
            sku_id: itemId,
            transaction_type: 'SALE',
            quantity_changed: quantity,
            notes: `Sold via POS (${receiptNumber})`,
         });
      }
    }

    // 3. Save Line Items & Audit Logs
    if (orderItems.length > 0) {
      const { error: itemsError } = await supabaseAdmin.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;
    }

    if (inventoryTransactions.length > 0) {
      const { error: txError } = await supabaseAdmin.from('inventory_transactions').insert(inventoryTransactions);
      if (txError) throw txError;
    }

    revalidatePath('/pos');
    revalidatePath('/sales');
    revalidatePath('/inventory');
    revalidatePath('/customers');
    
    return { data: { receiptNumber, date: order.created_at } };

  } catch (error: any) {
    console.error("POS Checkout Error:", error);
    return { error: error.message };
  }
}

export async function voidTransactionAction(orderId: string, receiptNumber: string) {
  try {
    const { error: voidError } = await supabaseAdmin
      .from('orders')
      .update({ is_voided: true })
      .eq('id', orderId);

    if (voidError) throw voidError;

    const { data: orderItems } = await supabaseAdmin
      .from('order_items')
      .select('sku_id, quantity')
      .eq('order_id', orderId);

    if (orderItems && orderItems.length > 0) {
      const inventoryTransactions = [];

      for (const item of orderItems) {
        const { data: currentItem } = await supabaseAdmin
          .from('inventory_items')
          .select('current_quantity, category')
          .eq('id', item.sku_id)
          .single();

        if (currentItem) {
          const category = currentItem.category || "";
          const isService = category.includes("Service") || category.includes("Treatment") || category === "Packages";
          
          if (!isService) {
            await supabaseAdmin
              .from('inventory_items')
              .update({ current_quantity: currentItem.current_quantity + item.quantity })
              .eq('id', item.sku_id);

            inventoryTransactions.push({
              sku_id: item.sku_id,
              transaction_type: 'IN',
              quantity_changed: item.quantity,
              notes: `Voided Return from POS (${receiptNumber})`,
            });
          }
        }
      }

      if (inventoryTransactions.length > 0) {
        await supabaseAdmin.from('inventory_transactions').insert(inventoryTransactions);
      }
    }

    revalidatePath('/sales');
    revalidatePath('/inventory');
    revalidatePath('/customers');

    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

// --- NEW SECURE FETCH ACTION ---
export async function getRetailSalesAction() {
  try {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        customers (
          full_name
        ),
        order_items (
          id,
          quantity,
          price_at_time,
          inventory_items (
            name,
            sku
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data };
  } catch (error: any) {
    console.error("Fetch Sales Error:", error);
    return { error: error.message };
  }
}