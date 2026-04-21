"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Users, Loader2, Mail, Phone, Calendar, MapPin, TrendingUp, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CustomersDashboard() {
  const { toast } = useToast();
  
  const [customers, setCustomers] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // UPGRADED: Modal State for both Create and Edit modes
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({ 
    fullName: "", phone: "", email: "", address: "", status: "Active", notes: "" 
  });

  const fetchCustomers = async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*, orders(grand_total)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const customersWithSpend = (data || []).map(c => {
        const total = c.orders?.reduce((sum: number, order: any) => sum + Number(order.grand_total || 0), 0) || 0;
        return { ...c, totalSpend: total };
      });

      setCustomers(customersWithSpend);
    } catch (error: any) {
      toast({ type: "error", message: "Failed to load customers." });
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredCustomers = customers.filter(customer => 
    customer.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (customer.phone && customer.phone.includes(searchQuery)) ||
    (customer.email && customer.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / itemsPerPage));
  const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // NEW: Open modal in Create mode
  const openCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    setFormData({ fullName: "", phone: "", email: "", address: "", status: "Active", notes: "" });
    setIsModalOpen(true);
  };

  // NEW: Open modal in Edit mode
  const openEditModal = (client: any) => {
    setModalMode('edit');
    setEditingId(client.id);
    setFormData({
      fullName: client.full_name || "",
      phone: client.phone || "",
      email: client.email || "",
      address: client.address || "",
      status: client.status || "Active",
      notes: client.notes || ""
    });
    setIsModalOpen(true);
  };

  // UPGRADED: Handles both Create and Update
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName) return toast({ type: "error", message: "Customer name is required." });
    
    setIsLoading(true);

    const payload = {
      full_name: formData.fullName,
      phone: formData.phone || null,
      email: formData.email || null,
      address: formData.address || null,
      status: formData.status,
      notes: formData.notes || null,
      is_walk_in: false 
    };

    try {
      let error;

      if (modalMode === 'create') {
        const { error: insertError } = await supabase.from('customers').insert([payload]);
        error = insertError;
      } else {
        const { error: updateError } = await supabase.from('customers').update(payload).eq('id', editingId);
        error = updateError;
      }

      if (error) throw error;

      toast({ type: "success", message: `Successfully ${modalMode === 'create' ? 'added' : 'updated'} ${formData.fullName}` });
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      toast({ type: "error", message: err.message || "Failed to save customer." });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VIP': return <span className="px-2.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 font-bold uppercase tracking-wider border border-amber-200">VIP</span>;
      case 'Banned': return <span className="px-2.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-700 font-bold uppercase tracking-wider border border-rose-200">Banned</span>;
      case 'Inactive': return <span className="px-2.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-bold uppercase tracking-wider border border-slate-200">Inactive</span>;
      default: return <span className="px-2.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700 font-bold uppercase tracking-wider border border-emerald-200">Active</span>;
    }
  };

  const totalCustomers = customers.length;
  const newThisMonth = customers.filter(c => {
    const createdDate = new Date(c.created_at);
    const now = new Date();
    return createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="w-full flex flex-col space-y-4 animate-in fade-in duration-300 min-h-[calc(100vh-8rem)]">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Client Directory</h2>
          </div>
          <p className="text-[13px] text-slate-500 mt-0.5">Manage customer profiles, statuses, and contact info.</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold shadow-sm">
          <Plus className="w-4 h-4" /> Add New Client
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div><p className="text-[13px] font-medium text-slate-500">Total Registered Clients</p><h3 className="text-2xl font-bold text-slate-900 mt-0.5">{totalCustomers}</h3></div>
          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600"><Users className="w-5 h-5" /></div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div><p className="text-[13px] font-medium text-slate-500">New Clients This Month</p><h3 className="text-2xl font-bold text-emerald-600 mt-0.5">+{newThisMonth}</h3></div>
          <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600"><Calendar className="w-5 h-5" /></div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        <div className="p-3 border-b border-slate-100 shrink-0 flex items-center justify-between bg-slate-50/50">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search by name, phone, or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" />
          </div>
          {isFetching && <Loader2 className="w-4 h-4 animate-spin text-slate-300 mr-2" />}
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] uppercase tracking-[0.1em] text-slate-500 font-bold">
                <th className="py-3 px-5 w-1/4">Client Details</th>
                <th className="py-3 px-5 text-center">Status</th>
                <th className="py-3 px-5 w-1/4">Contact Info</th>
                <th className="py-3 px-5 text-right">Lifetime Spend</th>
                <th className="py-3 px-5 text-right">Registered</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 && !isFetching ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100"><Users className="w-8 h-8 text-slate-300" /></div>
                      <h3 className="text-base font-bold text-slate-900 tracking-tight">No clients found</h3>
                      <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{searchQuery ? "Try adjusting your search filters." : "Click 'Add New Client' to create your first profile."}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold shadow-sm ${client.is_walk_in ? 'bg-slate-100 text-slate-400 border border-slate-200' : 'bg-indigo-600 text-white'}`}>
                          {client.is_walk_in ? 'W' : client.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            {client.full_name}
                            {client.is_walk_in && <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-500 font-bold uppercase tracking-wider border border-slate-200">Default</span>}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono mt-0.5">ID: {client.id.split('-')[0]}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-center">
                      {!client.is_walk_in && getStatusBadge(client.status || 'Active')}
                    </td>
                    <td className="py-3 px-5">
                      {client.is_walk_in ? (
                        <span className="text-slate-300 italic text-xs">Not applicable</span>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {client.phone && <div className="flex items-center gap-2 text-xs text-slate-600 font-medium"><Phone className="w-3.5 h-3.5 text-slate-400" /> {client.phone}</div>}
                          {client.email && <div className="flex items-center gap-2 text-xs text-slate-600 font-medium"><Mail className="w-3.5 h-3.5 text-slate-400" /> {client.email}</div>}
                          {client.address && <div className="flex items-start gap-2 text-xs text-slate-600 font-medium"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" /> <span className="line-clamp-1">{client.address}</span></div>}
                          {!client.phone && !client.email && !client.address && <span className="text-slate-400 italic text-xs">No contact info</span>}
                        </div>
                      )}
                    </td>
                    
                    <td className="py-3 px-5 text-right">
                      {client.is_walk_in ? (
                         <span className="text-slate-300 font-medium">—</span>
                      ) : (
                         <div className="flex flex-col items-end">
                           <span className="text-sm font-black text-slate-900">₱{client.totalSpend.toFixed(2)}</span>
                           {client.totalSpend > 0 && <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600 mt-0.5"><TrendingUp className="w-3 h-3" /> Paying Client</span>}
                         </div>
                      )}
                    </td>

                    <td className="py-3 px-5 text-right">
                      <span className="text-xs font-bold text-slate-500">{new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </td>
                    
                    <td className="py-3 px-5 text-right">
                      {!client.is_walk_in && (
                        <button 
                          onClick={() => openEditModal(client)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors inline-flex"
                          title="Edit Client"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isFetching && filteredCustomers.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white text-sm text-slate-500 shrink-0">
            <div>Showing <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredCustomers.length)}</span> of <span className="font-bold text-slate-900">{filteredCustomers.length}</span> clients</div>
            <div className="flex items-center gap-4">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 font-medium">Previous</button>
              <span className="font-medium text-slate-900 text-xs">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 font-medium">Next</button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {modalMode === 'create' ? 'Add New Client' : 'Edit Client Profile'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors">Close</button>
            </div>
            
            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-sm font-medium text-slate-700 block">Full Name <span className="text-rose-500">*</span></label>
                  <input autoComplete="off" type="text" required disabled={isLoading} value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full px-3 h-[42px] bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm" placeholder="e.g. Maria Clara" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 block">Status</label>
                  <select disabled={isLoading} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-3 h-[42px] bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm outline-none">
                    <option value="Active">Active</option>
                    <option value="VIP">VIP</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Banned">Banned</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 block">Phone Number</label>
                  <input autoComplete="off" type="tel" disabled={isLoading} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-3 h-[42px] bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm" placeholder="0917..." />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 block">Email Address</label>
                  <input autoComplete="off" type="email" disabled={isLoading} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 h-[42px] bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm" placeholder="maria@example.com" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">Address</label>
                <input autoComplete="off" type="text" disabled={isLoading} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-3 h-[42px] bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm" placeholder="123 Main St, Quezon City" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">Preferences / Notes</label>
                <textarea disabled={isLoading} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm resize-none" rows={2} placeholder="Allergies, preferred therapist, etc."></textarea>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={isLoading} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} 
                  {modalMode === 'create' ? 'Save Client' : 'Update Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}