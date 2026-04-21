"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Percent, PackageOpen, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getB2BSettingsAction, updateB2BSettingsAction } from "@/lib/actions/b2b";

export default function B2BSettingsPage() {
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // UI State (we multiply the decimal by 100 so it's easy to read, e.g. 0.30 becomes 30%)
  const [discountPercent, setDiscountPercent] = useState<number>(30); 
  const [moq, setMoq] = useState<number>(10);

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      const res = await getB2BSettingsAction();
      
      if (res.data) {
        setDiscountPercent(Number(res.data.b2b_discount_rate) * 100);
        setMoq(Number(res.data.b2b_moq));
      } else if (res.error) {
        toast({ type: "error", message: `Failed to load settings: ${res.error}` });
      }
      setIsLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (discountPercent < 0 || discountPercent > 100) {
      return toast({ type: "error", message: "Discount must be between 0 and 100." });
    }
    if (moq < 1) {
      return toast({ type: "error", message: "Minimum Order Quantity must be at least 1." });
    }

    setIsSaving(true);
    
    // Convert the UI percentage back to a decimal for the database (e.g., 30 becomes 0.30)
    const decimalDiscount = discountPercent / 100;
    
    const res = await updateB2BSettingsAction({ discountRate: decimalDiscount, moq });
    
    if (res.error) {
      toast({ type: "error", message: res.error });
    } else {
      toast({ type: "success", message: "B2B settings successfully updated! Changes are live." });
    }
    
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="w-full h-96 flex flex-col items-center justify-center text-stone-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="text-sm font-medium">Loading system configurations...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in duration-300">
      
      <div className="mb-8">
        <h1 className="text-2xl font-black text-stone-900 tracking-tight">Wholesale & B2B Rules</h1>
        <p className="text-sm text-stone-500 mt-1">Configure global pricing rules and minimum order requirements for distributors.</p>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        
        <div className="p-6 border-b border-stone-100 flex items-start gap-4 bg-blue-50/50">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
            <ShieldAlert className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900">Live Configuration</h3>
            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
              Changes made here take effect immediately across the entire platform. Distributors currently logged into the kiosk will see these updated rules on their next action.
            </p>
          </div>
        </div>

        <div className="p-8 space-y-8">
          
          {/* Discount Field */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-stone-900 flex items-center justify-between">
              Global Wholesale Discount
            </label>
            <p className="text-xs text-stone-500 -mt-2 mb-3">The percentage automatically deducted from the retail price for approved distributors.</p>
            
            <div className="relative max-w-xs">
              <input 
                type="number" 
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="w-full pl-4 pr-12 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-stone-900 font-bold" 
              />
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <Percent className="w-4 h-4 text-stone-400" />
              </div>
            </div>
          </div>

          <hr className="border-stone-100" />

          {/* MOQ Field */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-stone-900 flex items-center justify-between">
              Minimum Order Quantity (MOQ)
            </label>
            <p className="text-xs text-stone-500 -mt-2 mb-3">The minimum number of total items a distributor must have in their cart to checkout.</p>
            
            <div className="relative max-w-xs">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <PackageOpen className="w-4 h-4 text-stone-400" />
              </div>
              <input 
                type="number" 
                value={moq}
                onChange={(e) => setMoq(Number(e.target.value))}
                className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-stone-900 font-bold" 
              />
            </div>
          </div>

        </div>

        <div className="p-6 bg-stone-50 border-t border-stone-100 flex justify-end">
          <button 
            disabled={isSaving}
            onClick={handleSave}
            className="px-6 py-3 bg-stone-900 text-white font-bold rounded-xl hover:bg-stone-800 transition-all flex items-center gap-2 shadow-md disabled:opacity-70"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? "Saving..." : "Save Configuration"}
          </button>
        </div>

      </div>
    </div>
  );
}