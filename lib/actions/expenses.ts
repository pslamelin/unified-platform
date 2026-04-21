"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getExpensesAction(): Promise<{ data?: any[]; error?: string }> {
  try {
    // FIX: Added 'await' because Next.js 15 requires cookies to be resolved!
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
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

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data: data || [] };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function logExpenseAction(payload: {
  amount: number;
  category: string;
  description: string;
  expenseDate: string;
}): Promise<{ error?: string }> {
  try {
    // FIX: Added 'await' here as well
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const loggedBy = profile?.full_name || "Staff";

    const { error } = await supabase.from('expenses').insert([{
      amount: payload.amount,
      category: payload.category,
      description: payload.description || null,
      expense_date: payload.expenseDate,
      logged_by: loggedBy
    }]);

    if (error) throw error;
    return {}; // Success
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteExpenseAction(id: string): Promise<{ error?: string }> {
  try {
    // FIX: Added 'await'
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
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

    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    return {}; // Success
  } catch (error: any) {
    return { error: error.message };
  }
}