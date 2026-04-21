"use client";

import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { useToast } from "@/hooks/use-toast";

export function ImageUpload({ value, onChange, disabled }: { value: string; onChange: (url: string) => void; disabled?: boolean; }) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // 1. Generate a unique, safe filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;

      // 2. Upload straight to your new bucket
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 3. Get the public URL and send it to the form
      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
      
      onChange(data.publicUrl);
      toast({ type: "success", message: "Image uploaded successfully!" });

    } catch (error: any) {
      toast({ type: "error", message: "Failed to upload image." });
    } finally {
      setIsUploading(false);
    }
  };

  if (value) {
    return (
      <div className="relative w-28 h-28 shrink-0 rounded-xl overflow-hidden border border-slate-200 group shadow-sm">
        <img src={value} alt="Product upload" className="w-full h-full object-cover" />
        {!disabled && (
          <button type="button" onClick={() => onChange("")} className="absolute top-1.5 right-1.5 p-1 bg-rose-500/90 hover:bg-rose-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all shadow-sm">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-28 h-28 shrink-0 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50">
      {isUploading ? (
         <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      ) : (
        <>
          <ImagePlus className="w-6 h-6 text-slate-400" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Upload</span>
        </>
      )}
      <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" accept="image/png, image/jpeg, image/webp" onChange={handleUpload} disabled={disabled || isUploading} />
    </div>
  );
}