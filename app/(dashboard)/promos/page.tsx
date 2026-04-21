"use client";

import { useState, useEffect } from "react";
import { Search, Tag, Plus, Loader2, Calendar, CheckCircle2, XCircle, Percent, Gift, Banknote, Users, ChevronDown, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PromosDashboard() {
  const { toast } = useToast();
  
  const [promos, setPromos] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State (Upgraded to handle both Create and Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    code: "",
    description: "",
    discount_type: "PERCENTAGE",
    discount_value: "",
    buy_qty: "1",
    get_qty: "1",
    applicable_scope: "ENTIRE_ORDER", 
    target_id: "",
    valid_until: "",
    roles: { cashier: true, distributor: false }
  });

  const [skuSearchQuery, setSkuSearchQuery] = useState("");
  const [isSkuDropdownOpen, setIsSkuDropdownOpen] = useState(false);

  const loadData = async () => {
    setIsFetching(true);
    try {
      const [promosRes, invRes] = await Promise.all([
        supabase.from('promos').select('*').order('created_at', { ascending: false }),
        supabase.from('inventory_items').select('*').order('name')
      ]);

      if (promosRes.error) throw promosRes.error;
      setPromos(promosRes.data || []);
      setInventory(invRes.data || []);
    } catch (error: any) {
      toast({ type: "error", message: "Failed to load data." });
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('promos')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      
      setPromos(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
      toast({ type: "success", message: `Promo ${!currentStatus ? 'activated' : 'deactivated'} successfully.` });
    } catch (error: any) {
      toast({ type: "error", message: "Failed to update status." });
    }
  };

  // NEW: Open modal in Create mode
  const openCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    setFormData({
      code: "", description: "", discount_type: "PERCENTAGE", discount_value: "",
      buy_qty: "1", get_qty: "1", applicable_scope: "ENTIRE_ORDER", target_id: "",
      valid_until: "", roles: { cashier: true, distributor: false }
    });
    setSkuSearchQuery("");
    setIsModalOpen(true);
  };

  // NEW: Open modal in Edit mode and populate data
  const openEditModal = (promo: any) => {
    setModalMode('edit');
    setEditingId(promo.id);
    
    // Convert array back to checkbox state (ignoring case)
    const rolesArray = Array.isArray(promo.allowed_roles) ? promo.allowed_roles.map((r: string) => r.toLowerCase()) : [];
    
    setFormData({
      code: promo.code || "",
      description: promo.description || "",
      discount_type: promo.discount_type || "PERCENTAGE",
      discount_value: promo.discount_value ? String(promo.discount_value) : "",
      buy_qty: promo.buy_qty ? String(promo.buy_qty) : "1",
      get_qty: promo.get_qty ? String(promo.get_qty) : "1",
      applicable_scope: promo.applicable_scope || "ENTIRE_ORDER",
      target_id: promo.target_id || "",
      // Slice removes the seconds/timezone so it fits perfectly in the datetime-local input
      valid_until: promo.valid_until ? promo.valid_until.slice(0, 16) : "",
      roles: { 
        cashier: rolesArray.includes('cashier'), 
        distributor: rolesArray.includes('distributor') 
      }
    });

    // Populate the combobox search text if targeting a specific item
    if (promo.target_id) {
      const target = inventory.find(i => i.id === promo.target_id);
      if (target) setSkuSearchQuery(`${target.name} (${target.sku})`);
    } else {
      setSkuSearchQuery("");
    }

    setIsModalOpen(true);
  };

  // UPGRADED: Handles both Create and Update
  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code) return toast({ type: "error", message: "Promo code is required." });
    if (formData.applicable_scope === 'SPECIFIC_SKU' && !formData.target_id) return toast({ type: "error", message: "Please select a target product." });
    
    setIsLoading(true);
    
    const allowed_roles = [];
    if (formData.roles.cashier) allowed_roles.push('Cashier');
    if (formData.roles.distributor) allowed_roles.push('Distributor');

    if (allowed_roles.length === 0) {
      setIsLoading(false);
      return toast({ type: "error", message: "Select at least one allowed role." });
    }

    const payload = {
      code: formData.code.toUpperCase(),
      description: formData.description,
      discount_type: formData.discount_type,
      discount_value: formData.discount_type !== 'BOGO' ? Number(formData.discount_value || 0) : 0,
      buy_qty: formData.discount_type === 'BOGO' ? Number(formData.buy_qty) : 0,
      get_qty: formData.discount_type === 'BOGO' ? Number(formData.get_qty) : 0,
      applicable_scope: formData.applicable_scope,
      target_id: formData.applicable_scope === 'SPECIFIC_SKU' ? formData.target_id : null,
      allowed_roles: allowed_roles,
      valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
    };

    try {
      let error;
      
      if (modalMode === 'create') {
        const { error: insertError } = await supabase.from('promos').insert([{ ...payload, is_active: true }]);
        error = insertError;
      } else {
        const { error: updateError } = await supabase.from('promos').update(payload).eq('id', editingId);
        error = updateError;
      }

      if (error) {
        if (error.code === '23505') throw new Error("This Promo Code already exists!");
        throw error;
      }

      toast({ type: "success", message: `Promo ${modalMode === 'create' ? 'created' : 'updated'} successfully!` });
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      toast({ type: "error", message: err.message || "Failed to save promo." });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPromos = promos.filter(p => p.code.toLowerCase().includes(searchQuery.toLowerCase()) || p.description?.toLowerCase().includes(searchQuery.toLowerCase()));
  const activeCount = promos.filter(p => p.is_active).length;

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(skuSearchQuery.toLowerCase()) || 
    item.sku.toLowerCase().includes(skuSearchQuery.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col space-y-4 animate-in fade-in duration-300 min-h-[calc(100vh-8rem)]">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Promos & Deals Engine</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Manage automated discounts, VIP perks, and BOGO deals.</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold shadow-sm">
          <Plus className="w-4 h-4" /> Create New Promo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-center justify-between">
          <div><p className="text-xs font-medium text-slate-500">Active Deals Running</p><h3 className="text-xl font-bold text-emerald-600 mt-0.5">{activeCount}</h3></div>
          <div className="w-8 h-8 bg-emerald-50 rounded-md flex items-center justify-center text-emerald-600"><CheckCircle2 className="w-4 h-4" /></div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-center justify-between">
          <div><p className="text-xs font-medium text-slate-500">Total Rules Configured</p><h3 className="text-xl font-bold text-slate-900 mt-0.5">{promos.length}</h3></div>
          <div className="w-8 h-8 bg-blue-50 rounded-md flex items-center justify-center text-blue-600"><Tag className="w-4 h-4" /></div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        <div className="p-2.5 border-b border-slate-100 shrink-0 flex items-center justify-between bg-slate-50/50">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" placeholder="Search by code or description..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-4 py-1.5 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs" />
          </div>
          {isFetching && <Loader2 className="w-4 h-4 animate-spin text-slate-300 mr-2" />}
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[9px] uppercase tracking-[0.1em] text-slate-500 font-bold">
                <th className="py-2.5 px-4">Promo Code</th>
                <th className="py-2.5 px-4">Deal Mechanics</th>
                <th className="py-2.5 px-4">Scope / Target</th>
                <th className="py-2.5 px-4">Allowed Roles</th>
                <th className="py-2.5 px-4">Valid Until</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPromos.length === 0 && !isFetching ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3 border border-slate-100"><Tag className="w-6 h-6 text-slate-300" /></div>
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight">No promos found</h3>
                      <p className="text-xs text-slate-500 mt-1">Create your first discount rule to get started.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPromos.map((promo) => {
                  const isExpired = promo.valid_until && new Date(promo.valid_until) < new Date();
                  const showInactive = !promo.is_active || isExpired;
                  
                  const dbType = String(promo.discount_type || '').toUpperCase();
                  const isPercentage = dbType === 'PERCENTAGE';
                  const isFixed = dbType === 'FIXED_AMOUNT' || dbType === 'FIXED';
                  const isBogo = dbType === 'BOGO' || dbType === 'BUY_X_GET_Y';
                  
                  const targetItem = promo.target_id ? inventory.find(i => i.id === promo.target_id || i.sku === promo.target_id) : null;

                  return (
                    <tr key={promo.id} className={`hover:bg-slate-50/80 transition-colors ${showInactive ? 'opacity-60' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 text-sm tracking-wider font-mono">{promo.code}</span>
                          <span className="text-[10px] text-slate-500 mt-0.5">{promo.description || 'No description'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {isPercentage && <Percent className="w-4 h-4 text-blue-500" />}
                          {isFixed && <Banknote className="w-4 h-4 text-emerald-500" />}
                          {isBogo && <Gift className="w-4 h-4 text-purple-500" />}
                          
                          <span className="text-xs font-bold text-slate-700">
                            {isPercentage && `${promo.discount_value}% OFF`}
                            {isFixed && `₱${promo.discount_value} OFF`}
                            {isBogo && `Buy ${promo.buy_qty} Get ${promo.get_qty} Free`}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                          {promo.applicable_scope === 'ENTIRE_ORDER' ? 'Entire Cart' : (targetItem ? targetItem.name : `Target: ${promo.target_id}`)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1.5 flex-wrap">
                          {Array.isArray(promo.allowed_roles) && promo.allowed_roles.map((role: string) => (
                            <span key={role} className="text-[9px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                              {role}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-medium ${isExpired ? 'text-rose-500 font-bold' : 'text-slate-600'}`}>
                          {promo.valid_until ? new Date(promo.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No Expiry'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {/* NEW: Added flex container to align the Pencil icon and Toggle nicely */}
                        <div className="flex items-center justify-end gap-3">
                          <button 
                            onClick={() => openEditModal(promo)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Edit Promo"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleToggleActive(promo.id, promo.is_active)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${promo.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${promo.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-indigo-600" /> 
                {modalMode === 'create' ? 'Configure New Promo' : 'Edit Promo'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors"><XCircle className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSavePromo} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Promo Code <span className="text-rose-500">*</span></label>
                  <input type="text" required placeholder="e.g. VIP20, SUMMER500" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm font-mono uppercase" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Description</label>
                  <input type="text" placeholder="Internal note (e.g. 20% off for VIPs)" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm" />
                </div>
              </div>

              <div className="h-px bg-slate-100 w-full" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Deal Type</label>
                  <select value={formData.discount_type} onChange={e => setFormData({...formData, discount_type: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm outline-none">
                    <option value="PERCENTAGE">% Percentage Off</option>
                    <option value="FIXED_AMOUNT">₱ Flat Amount Off</option>
                    <option value="BOGO">Buy X Get Y (e.g. 5+1)</option>
                  </select>
                </div>

                {formData.discount_type !== 'BOGO' ? (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Discount Value</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">{formData.discount_type === 'PERCENTAGE' ? '%' : '₱'}</span>
                      <input type="number" min="0" step="any" required placeholder="e.g. 10" value={formData.discount_value} onChange={e => setFormData({...formData, discount_value: e.target.value})} className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Buy</label>
                      <input type="number" min="1" required value={formData.buy_qty} onChange={e => setFormData({...formData, buy_qty: e.target.value})} className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-sm text-center" />
                    </div>
                    <span className="pb-2 text-slate-400 font-bold text-xs">Get</span>
                    <div className="flex-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block text-center">Free</label>
                      <input type="number" min="1" required value={formData.get_qty} onChange={e => setFormData({...formData, get_qty: e.target.value})} className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-sm text-center text-emerald-600 font-bold" />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Applies To</label>
                  <select value={formData.applicable_scope} onChange={e => setFormData({...formData, applicable_scope: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none">
                    <option value="ENTIRE_ORDER">Entire Order / Cart</option>
                    <option value="SPECIFIC_SKU">Specific Product / SKU</option>
                  </select>
                </div>
                
                {formData.applicable_scope === 'SPECIFIC_SKU' && (
                  <div className="relative z-20">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Target Product</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Search product..." 
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                        value={skuSearchQuery}
                        onChange={(e) => {
                          setSkuSearchQuery(e.target.value);
                          setFormData(prev => ({ ...prev, target_id: "" })); 
                          setIsSkuDropdownOpen(true);
                        }}
                        onFocus={(e) => {
                          e.target.select();
                          setIsSkuDropdownOpen(true);
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            setIsSkuDropdownOpen(false);
                            const selected = inventory.find(i => i.id === formData.target_id);
                            if (selected) setSkuSearchQuery(`${selected.name} (${selected.sku})`);
                          }, 200);
                        }}
                      />
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      
                      {isSkuDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setIsSkuDropdownOpen(false)} />
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-20 py-1">
                            {filteredInventory.length === 0 ? (
                              <div className="p-3 text-xs text-slate-500 text-center">No products found</div>
                            ) : (
                              filteredInventory.map(item => (
                                <button 
                                  key={item.id} 
                                  type="button"
                                  onClick={() => {
                                    setFormData(prev => ({ ...prev, target_id: item.id })); 
                                    setSkuSearchQuery(`${item.name} (${item.sku})`); 
                                    setIsSkuDropdownOpen(false);
                                  }} 
                                  className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex flex-col border-b border-slate-50 last:border-0"
                                >
                                  <span className="text-sm font-bold text-slate-900 line-clamp-1">{item.name}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">{item.sku}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="h-px bg-slate-100 w-full" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block flex items-center gap-1"><Users className="w-3 h-3" /> Allowed Roles</label>
                   <div className="space-y-2">
                     <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                       <input type="checkbox" checked={formData.roles.cashier} onChange={e => setFormData({...formData, roles: {...formData.roles, cashier: e.target.checked}})} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" /> Retail Cashier
                     </label>
                     <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                       <input type="checkbox" checked={formData.roles.distributor} onChange={e => setFormData({...formData, roles: {...formData.roles, distributor: e.target.checked}})} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" /> Self-Service Distributor
                     </label>
                   </div>
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block flex items-center gap-1"><Calendar className="w-3 h-3" /> Valid Until</label>
                   <input type="datetime-local" value={formData.valid_until} onChange={e => setFormData({...formData, valid_until: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500" />
                   <p className="text-[9px] text-slate-400 mt-1">Leave blank for no expiration.</p>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={isLoading} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (modalMode === 'create' ? "Save Rule" : "Update Rule")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}