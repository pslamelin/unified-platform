"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const createActionClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set(name, value, options);
          } catch (error) {}
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set(name, "", { ...options, maxAge: 0 });
          } catch (error) {}
        },
      },
    }
  );
};

// 1. Fetch the catalog (Safely)
export async function getB2BCatalogAction(): Promise<{ data?: any[]; error?: string }> {
  try {
    const supabase = await createActionClient();

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      // FIXED: Changed 'product_name' to 'name' to match your database schema
      .order('name', { ascending: true }); 

    if (error) throw error;
    return { data: data || [] };
  } catch (error: any) {
    console.log("Supabase Fetch Error:", error.message);
    return { error: error.message };
  }
}

// 2. Submit the Bulk Order
export async function submitB2BOrderAction(payload: {
  cart: any[];
  totalAmount: number;
  notes: string;
}): Promise<{ success?: boolean; poNumber?: string; error?: string }> {
  try {
    const supabase = await createActionClient();

    // Identify who is ordering
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized: Please log in.");

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const distributorName = profile?.full_name || "Unknown Distributor";
    
    // Generate a unique Purchase Order number
    const poNumber = `PO-${Math.floor(100000 + Math.random() * 900000)}`;

    // 1. Create the main Order Record
    const { data: orderData, error: orderError } = await supabase
      .from('b2b_orders')
      .insert([{
        distributor_id: user.id,
        distributor_name: distributorName,
        po_number: poNumber,
        status: 'Pending Approval',
        total_amount: payload.totalAmount,
        notes: payload.notes || null
      }])
      .select('id')
      .single();

    if (orderError) throw orderError;

    // 2. Format and insert the Order Items
    const orderItems = payload.cart.map(item => ({
      b2b_order_id: orderData.id,
      product_name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      wholesale_price: item.wholesalePrice,
      subtotal: item.wholesalePrice * item.quantity
    }));

    const { error: itemsError } = await supabase
      .from('b2b_order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    return { success: true, poNumber };
  } catch (error: any) {
    return { error: error.message };
  }
}

// 3. Fetch Dynamic System Settings
export async function getB2BSettingsAction(): Promise<{ data?: any; error?: string }> {
  try {
    const supabase = await createActionClient();

    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) throw error;
    return { data };
  } catch (error: any) {
    return { error: error.message };
  }
}

// 4. Update Dynamic System Settings
export async function updateB2BSettingsAction(payload: { discountRate: number; moq: number }): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createActionClient();

    // Identify who is updating the settings for security
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized: Please log in.");

    // Update the system settings (ID 1 is our global row)
    const { error: updateError } = await supabase
      .from('system_settings')
      .update({
        b2b_discount_rate: payload.discountRate,
        b2b_moq: payload.moq
      })
      .eq('id', 1);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

// 5. Fetch Active B2B Promos
export async function getB2BPromosAction(): Promise<{ data?: any[]; error?: string }> {
  try {
    const supabase = await createActionClient();

    // Fetch ALL active promos (Removed the BOGO-only restriction)
    const { data, error } = await supabase
      .from('promos')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    // Safely filter to ensure this promo is specifically allowed for distributors
    const b2bPromos = (data || []).filter(promo => {
      if (!promo.allowed_roles) return false;
      // Handle both stringified JSON or native Postgres arrays
      const rolesArray = Array.isArray(promo.allowed_roles) 
        ? promo.allowed_roles 
        : JSON.parse(promo.allowed_roles);
        
      return rolesArray.some((role: string) => role.toLowerCase() === 'distributor');
    });

    return { data: b2bPromos };
  } catch (error: any) {
    return { error: error.message };
  }
}


import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getMyB2BOrdersAction(distributorId: string) {
  try {
    // Securely fetch ONLY the orders belonging to this specific user using the Master Key
    const { data, error } = await supabaseAdmin
      .from('b2b_orders')
      .select(`
        *,
        b2b_order_items (*)
      `)
      .eq('distributor_id', distributorId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data };
  } catch (error: any) {
    return { error: error.message };
  }
}