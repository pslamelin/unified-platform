"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getDashboardMetricsAction(selectedMonth: number, selectedYear: number) {
  try {
    const now = new Date();
    
    // Set the date range based on the filter
    const startDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999); // Last day of month

    // 1. Fetch Retail Sales
    const { data: retailSales } = await supabaseAdmin
      .from('orders')
      .select('id, receipt_number, grand_total, created_at, customer_id, is_voided')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .eq('is_voided', false)
      .order('created_at', { ascending: false });

    // 2. Fetch B2B Wholesale Sales
    const { data: b2bSales } = await supabaseAdmin
      .from('b2b_orders')
      .select('id, po_number, total_amount, created_at, status')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .neq('status', 'Cancelled')
      .order('created_at', { ascending: false });

    // 3. Fetch Expenses (Wrapped in try/catch just in case the table is empty/new)
    let expensesData: any[] = [];
    try {
      const { data } = await supabaseAdmin
        .from('expenses')
        .select('amount, created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
      if (data) expensesData = data;
    } catch (e) {
      console.warn("Expenses table fetch failed. It might not exist yet.");
    }

    // 4. Fetch Low Stock Items
    const { data: inventory } = await supabaseAdmin
      .from('inventory_items')
      .select('id, sku, name, current_quantity, low_stock_threshold, category');

    let lowStockAlerts = [];
    if (inventory) {
      lowStockAlerts = inventory.filter(item => {
        const isService = item.category?.includes("Service") || item.category?.includes("Treatment") || item.category === "Packages";
        return !isService && item.current_quantity <= item.low_stock_threshold;
      });
    }

    // --- CRUNCH NUMBERS ---
    let totalRetailRevenue = 0;
    let totalB2BRevenue = 0;
    let totalExpenses = 0;
    let todayWalkIn = 0;
    let todayRegistered = 0;
    
    // Create an array for every day of the selected month (e.g., 1 to 31)
    const daysInMonth = endDate.getDate();
    const chartData = Array.from({length: daysInMonth}, (_, i) => ({
      day: i + 1,
      retail: 0,
      b2b: 0,
      total: 0 
    }));

    let recentTransactions: any[] = [];

    if (retailSales) {
      retailSales.forEach(order => {
        const amt = Number(order.grand_total || 0);
        totalRetailRevenue += amt;
        
        const orderDate = new Date(order.created_at);
        const dayOfMonth = orderDate.getDate();
        
        // Add to daily chart
        if (chartData[dayOfMonth - 1]) {
           chartData[dayOfMonth - 1].retail += amt;
           chartData[dayOfMonth - 1].total += amt;
        }

        // Count today's foot traffic
        if (orderDate.toDateString() === now.toDateString()) {
          if (order.customer_id) todayRegistered++;
          else todayWalkIn++;
        }

        recentTransactions.push({ id: order.id, ref: order.receipt_number || 'POS Walk-in', amount: amt, type: 'Retail', date: order.created_at });
      });
    }

    if (b2bSales) {
      b2bSales.forEach(order => {
        const amt = Number(order.total_amount || 0);
        if (order.status === 'Completed') {
          totalB2BRevenue += amt;
          const dayOfMonth = new Date(order.created_at).getDate();
          if (chartData[dayOfMonth - 1]) {
             chartData[dayOfMonth - 1].b2b += amt;
             chartData[dayOfMonth - 1].total += amt;
          }
        }
        recentTransactions.push({ id: order.id, ref: order.po_number, amount: amt, type: `B2B (${order.status})`, date: order.created_at });
      });
    }

    if (expensesData) {
      expensesData.forEach(exp => {
        totalExpenses += Number(exp.amount || 0);
      });
    }

    // Sort recent transactions and grab the latest 10
    recentTransactions = recentTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

    const grossSales = totalRetailRevenue + totalB2BRevenue;
    const netSales = grossSales - totalExpenses;

    return {
       data: {
          grossSales,
          netSales,
          totalExpenses,
          retailRevenue: totalRetailRevenue,
          b2bRevenue: totalB2BRevenue,
          todayWalkIn,
          todayRegistered,
          lowStockAlerts: lowStockAlerts.sort((a, b) => a.current_quantity - b.current_quantity), 
          chartData,
          recentTransactions
       }
    };

  } catch (error: any) {
     return { error: error.message };
  }
}