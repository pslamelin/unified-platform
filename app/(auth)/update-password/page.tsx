"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function UpdatePasswordPage() {
  const { toast } = useToast();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 8) {
      toast({ type: "warning", message: "Password must be at least 8 characters long." });
      return;
    }

    if (password !== confirmPassword) {
      toast({ type: "error", message: "Passwords do not match. Please try again." });
      return;
    }

    setIsLoading(true);

    try {
      // 1. Update the actual Auth password
      const { data: authData, error: authError } = await supabase.auth.updateUser({
        password: password
      });

      if (authError) throw authError;

      // 2. Remove the "Force Password Change" flag and VERIFY it actually saved
      const { data: updatedProfile, error: profileError } = await supabase
        .from('profiles')
        .update({ requires_password_change: false })
        .eq('id', authData.user.id)
        .select('role, requires_password_change')
        .single(); 

      if (profileError) {
        throw new Error("Security block: Unable to update profile status. Please contact an admin.");
      }

      // 3. Force Supabase to explicitly refresh the session cookies
      await supabase.auth.refreshSession();

      toast({ type: "success", message: "Password secured! Redirecting to portal..." });

      // 4. Hard redirect after a brief delay so the cookies and middleware have time to sync
      const safeRole = String(updatedProfile?.role || "").trim().toLowerCase();
      
      setTimeout(() => {
        // FIXED: Bulletproof routing matching the Login page
        if (["super admin", "manager"].includes(safeRole)) {
          window.location.replace("/inventory");
        } else if (safeRole === "distributor") {
          window.location.replace("/distributor/kiosk"); // Distributors go to Kiosk
        } else {
          window.location.replace("/pos");
        }
      }, 1000); 
      
    } catch (error: any) {
      toast({ type: "error", message: error.message || "Failed to update password." });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-stone-50 p-4 sm:p-8 font-sans antialiased">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden transition-all animate-in zoom-in-95 duration-300">
        
        <div className="p-8 text-center border-b border-stone-100 bg-white">
          <div className="flex items-center justify-center gap-4 h-12 mb-6">
            <img src="/LamelinLogo.png" alt="Lamelin" className="h-full w-auto object-contain" />
            <div className="h-8 w-px bg-stone-200"></div>
            <img src="/PrettySkinLogo.png" alt="Pretty Skin" className="h-full w-auto object-contain" />
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Welcome Aboard</h1>
          <p className="text-sm text-stone-500 mt-2">
            For security reasons, you must set a permanent password before accessing the system.
          </p>
        </div>

        <div className="p-8 bg-stone-50/50">
          <form onSubmit={handleUpdate} className="space-y-5">
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-stone-700">New Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-stone-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-10 pr-12 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-stone-900 shadow-sm"
                  placeholder="At least 8 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-stone-700">Confirm New Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-stone-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-10 pr-12 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-stone-900 shadow-sm"
                  placeholder="Repeat new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 transition-colors mt-4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                  Securing Account...
                </>
              ) : (
                "Save & Continue"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}