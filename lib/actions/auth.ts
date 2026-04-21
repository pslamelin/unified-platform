"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { createClient } from '@supabase/supabase-js';

// 1. REGISTER NEW USER
export async function registerUserAction(formData: any) {
  const { email, password, fullName, role } = formData;

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) return { error: authError.message };

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert([{ 
      id: authUser.user.id, 
      full_name: fullName, 
      email: email,             // Saving email to profile
      role: role,
      status: 'Active',         // Default status
      requires_password_change: true 
    }]);

  if (profileError) return { error: profileError.message };

  revalidatePath('/settings/user-management');
  return { success: true };
}

// 2. TOGGLE USER ACCESS (ACTIVE / INACTIVE)
export async function toggleUserStatusAction(userId: string, currentStatus: string) {
  const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
  
  // Update the profile label
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ status: newStatus })
    .eq('id', userId);
    
  if (error) return { error: error.message };

  // CRITICAL: Actually ban/unban the user at the Auth level so they cannot log in
  if (newStatus === 'Inactive') {
    await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "876000h" }); // Suspended
  } else {
    await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "none" }); // Restored
  }

  revalidatePath('/settings/user-management');
  return { success: true, newStatus };
}

// 3. EDIT EXISTING USER DETAILS
export async function updateUserAction(formData: any) {
  const { id, fullName, email, role } = formData;
  
  // 1. Update their actual login email in Auth
  if (email) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, { email: email });
    if (authError) return { error: authError.message };
  }

  // 2. Update their profile details
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ full_name: fullName, email: email, role: role })
    .eq('id', id);
    
  if (profileError) return { error: profileError.message };

  revalidatePath('/settings/user-management');
  return { success: true };
}

// Add this right to the bottom of the file
export async function resetUserPasswordAction(userId: string, newPassword: string) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );

    // 1. Force update the user's secure Auth password in Supabase
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, { 
      password: newPassword 
    });

    if (authError) return { error: authError.message };

    // 2. Set the flag in the profiles table to trigger the Security Interceptor
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ requires_password_change: true })
      .eq('id', userId);

    if (profileError) return { error: profileError.message };

    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}