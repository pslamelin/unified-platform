"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Loader2, ArrowDownRight, Calendar, DollarSign, Pencil, Receipt, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ExpensesDashboard() {
  const { toast } = useToast();
  
  const [expenses, setExpenses] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState("System User");
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({ 
    expenseDate: new Date().toISOString().split('T')[0], 
    category: "Supplies", 
    amount: "", 
    description: "" 
  });

  const loadData = async () => {
    setIsFetching(true);
    try {
      // 1. Get the current user's name for the "logged_by" field
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', authData.user.id)
          .single();
        if (profile?.full_name) setCurrentUser(profile.full_name);
      }

      // 2. Fetch all expenses
      const { data: expenseData, error } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpenses(expenseData || []);
    } catch (error: any) {
      toast({ type: "error", message: "Failed to load expenses." });
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredExpenses = expenses.filter(exp => 
    exp.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exp.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    exp.logged_by?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / itemsPerPage));
  const paginatedExpenses = filteredExpenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const openCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    setFormData({ 
      expenseDate: new Date().toISOString().split('T')[0], 
      category: "Supplies", 
      amount: "", 
      description: "" 
    });
    setIsModalOpen(true);
  };

  const openEditModal = (expense: any) => {
    setModalMode('edit');
    setEditingId(expense.id);
    setFormData({
      expenseDate: expense.expense_date || new Date().toISOString().split('T')[0],
      category: expense.category || "Supplies",
      amount: String(expense.amount || ""),
      description: expense.description || ""
    });
    setIsModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || isNaN(Number(formData.amount))) return toast({ type: "error", message: "Please enter a valid amount." });
    if (!formData.description) return toast({ type: "error", message: "Description is required." });
    
    setIsLoading(true);

    const payload = {
      expense_date: formData.expenseDate,
      category: formData.category,
      amount: Number(formData.amount),
      description: formData.description,
      logged_by: currentUser 
    };

    try {
      let error;
      if (modalMode === 'create') {
        const { error: insertError } = await supabase.from('expenses').insert([payload]);
        error = insertError;
      } else {
        const { error: updateError } = await supabase.from('expenses').update(payload).eq('id', editingId);
        error = updateError;
      }

      if (error) throw error;

      toast({ type: "success", message: `Expense successfully ${modalMode === 'create' ? 'logged' : 'updated'}.` });
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      toast({ type: "error", message: err.message || "Failed to save expense." });
    } finally {
      setIsLoading(false);
    }
  };

  // --- STATS CALCULATIONS ---
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const thisMonthTotal = expenses.filter(e => {
    const d = new Date(e.expense_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).reduce((sum, e) => sum + Number(e.amount), 0);

  // NEW: Calculate Last Month's Total
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  
  const lastMonthTotal = expenses.filter(e => {
    const d = new Date(e.expense_date);
    return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
  }).reduce((sum, e) => sum + Number(e.amount), 0);

  const allTimeTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const categoryTotals = expenses.reduce((acc: any, curr: any) => {
    acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount);
    return acc;
  }, {});
  
  const topCategory = Object.entries(categoryTotals).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || "None";

  return (
    <div className="w-full flex flex-col space-y-4 animate-in fade-in duration-300 min-h-[calc(100vh-8rem)]">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-rose-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Expense Tracker</h2>
          </div>
          <p className="text-[13px] text-slate-500 mt-0.5">Log operational costs, supplies, and facility maintenance.</p>
        </div>
        <button onClick={openCreateModal} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold shadow-sm">
          <Plus className="w-4 h-4" /> Log Expense
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div><p className="text-[13px] font-medium text-slate-500">This Month's Expenses</p><h3 className="text-2xl font-bold text-rose-600 mt-0.5">₱{thisMonthTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3></div>
          <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center text-rose-600"><ArrowDownRight className="w-5 h-5" /></div>
        </div>
        
        {/* UPDATED MIDDLE CARD */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div><p className="text-[13px] font-medium text-slate-500">Last Month's Expenses</p><h3 className="text-2xl font-bold text-slate-900 mt-0.5">₱{lastMonthTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3></div>
          <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600"><Calendar className="w-5 h-5" /></div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div><p className="text-[13px] font-medium text-slate-500">All-Time Expenses</p><h3 className="text-2xl font-bold text-slate-900 mt-0.5">₱{allTimeTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3></div>
          <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-600"><DollarSign className="w-5 h-5" /></div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        <div className="p-3 border-b border-slate-100 shrink-0 flex items-center justify-between bg-slate-50/50">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search by description, category, or user..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" />
          </div>
          {isFetching && <Loader2 className="w-4 h-4 animate-spin text-slate-300 mr-2" />}
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] uppercase tracking-[0.1em] text-slate-500 font-bold">
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Description</th>
                <th className="py-3 px-5">Category</th>
                <th className="py-3 px-5 text-right">Amount</th>
                <th className="py-3 px-5">Logged By</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 && !isFetching ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100"><Receipt className="w-8 h-8 text-slate-300" /></div>
                      <h3 className="text-base font-bold text-slate-900 tracking-tight">No expenses logged</h3>
                      <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{searchQuery ? "Try adjusting your search filters." : "Click 'Log Expense' to record your first operational cost."}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-700">
                          {new Date(expense.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-5">
                      <span className="text-sm font-medium text-slate-900">{expense.description}</span>
                    </td>
                    <td className="py-3 px-5">
                      <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {expense.category}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right">
                      <span className="text-sm font-black text-rose-600">- ₱{Number(expense.amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </td>
                    <td className="py-3 px-5">
                      <span className="text-xs text-slate-500 font-medium">{expense.logged_by}</span>
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button 
                        onClick={() => openEditModal(expense)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors inline-flex"
                        title="Edit Expense"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isFetching && filteredExpenses.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white text-sm text-slate-500 shrink-0">
            <div>Showing <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredExpenses.length)}</span> of <span className="font-bold text-slate-900">{filteredExpenses.length}</span> expenses</div>
            <div className="flex items-center gap-4">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 font-medium">Previous</button>
              <span className="font-medium text-slate-900 text-xs">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 font-medium">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* --- CREATE / EDIT MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-rose-600" />
                  {modalMode === 'create' ? 'Log New Expense' : 'Edit Expense'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors"><XCircle className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSaveExpense} className="p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 block">Date of Expense <span className="text-rose-500">*</span></label>
                  <input type="date" required disabled={isLoading} value={formData.expenseDate} onChange={e => setFormData({...formData, expenseDate: e.target.value})} className="w-full px-3 h-[42px] bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 block">Category <span className="text-rose-500">*</span></label>
                  <select required disabled={isLoading} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-3 h-[42px] bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm outline-none">
                    <option value="Utilities">Utilities (Water, Electricity, Internet)</option>
                    <option value="Payroll">Payroll & Wages</option>
                    <option value="Supplies">Consumables & Supplies</option>
                    <option value="Marketing">Marketing & Ads</option>
                    <option value="Maintenance">Facility Maintenance</option>
                    <option value="Rent">Rent</option>
                    <option value="Other">Other Operational Costs</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">Amount (₱) <span className="text-rose-500">*</span></label>
                <input type="number" step="0.01" min="0" required disabled={isLoading} value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full px-3 h-[42px] bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-rose-600" placeholder="0.00" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 block">Description <span className="text-rose-500">*</span></label>
                <textarea required disabled={isLoading} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm resize-none" rows={3} placeholder="e.g. Restocked facial cotton pads and alcohol"></textarea>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={isLoading} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} 
                  {modalMode === 'create' ? 'Save Expense' : 'Update Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}