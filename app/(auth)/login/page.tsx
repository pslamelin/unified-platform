"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast"; 

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({ type: "warning", message: "Please enter both email and password." });
      return;
    }

    setIsLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("No user returned from authentication.");

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", authData.user.id)
        .single();

      if (profileError) {
        throw new Error("Could not verify user access level. Please contact admin.");
      }

      // 1. Block suspended accounts
      if (profileData?.status === 'Inactive') {
        await supabase.auth.signOut();
        throw new Error("This account has been suspended.");
      }

      const rawRole = profileData?.role || "";
      
      // 2. Normalize the role to lowercase and trim spaces
      const safeRole = String(rawRole).trim().toLowerCase();

      toast({ type: "success", message: `Welcome back! Logged in as ${rawRole}.` });

      // 3. Bulletproof Routing Logic
      if (["super admin", "manager"].includes(safeRole)) {
        router.push('/');
      } else if (safeRole === "distributor") {
        router.push("/distributor/kiosk"); // NEW: Distributors go straight to their Kiosk!
      } else if (["staff", "cashier"].includes(safeRole)) {
        router.push("/pos"); // Staff go to POS
      } else {
        await supabase.auth.signOut();
        toast({ type: "error", message: "Account does not have an active system role." });
      }
      
    } catch (error: any) {
      console.error("Login Error:", error);
      toast({ 
        type: "error", 
        message: error.message || "Failed to sign in. Please check your credentials." 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-stone-50 p-4 sm:p-8 font-sans antialiased">
      
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden transition-all">
        
        <div className="p-8 text-center border-b border-stone-100 bg-white">
          <div className="flex items-center justify-center gap-4 h-12 mb-6">
            <img 
              src="/PrettySkinLogo.png" 
              alt="Pretty Skin" 
              className="h-full w-auto object-contain" 
            />
            <div className="h-8 w-px bg-stone-200"></div>
            <img 
              src="/LamelinLogo.png" 
              alt="Lamelin" 
              className="h-full w-auto object-contain" 
            />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">System Login</h1>
          <p className="text-[11px] font-bold text-stone-400 mt-2 tracking-[0.2em] uppercase">
            Business Portal
          </p>
        </div>

        <div className="p-8 bg-stone-50/50">
          <form onSubmit={handleLogin} className="space-y-6">
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-stone-700" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-stone-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed text-stone-900 shadow-sm"
                  placeholder="admin@lamelin.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-stone-700" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-stone-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-10 pr-12 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed text-stone-900 shadow-sm"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1} 
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700 transition-colors focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-stone-900 hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-900 disabled:opacity-70 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                  Authenticating...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}