"use client";

import { useState, useEffect } from "react";
import { Search, Download, Plus, Key, Edit2, X, Shield, Mail, Users, Loader2, RefreshCw, Copy, AlertCircle, CheckCircle2, UserX, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { registerUserAction, toggleUserStatusAction, updateUserAction } from "@/lib/actions/auth"; 
import { createBrowserClient } from "@supabase/ssr";

export default function UserManagementPage() {
  const { toast } = useToast();
  
  const [tableData, setTableData] = useState<any[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  
  // States for our forms
  const [formData, setFormData] = useState({ fullName: "", email: "", password: "", role: "" });
  const [editData, setEditData] = useState({ id: "", fullName: "", email: "", role: "" });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchUsers = async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setTableData(data || []);
    } catch (error: any) {
      console.error("Fetch Error:", error.message);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let newPassword = "";
    for (let i = 0; i < 10; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password: newPassword });
  };

  const copyToClipboard = () => {
    if (!formData.password) {
      toast({ type: "warning", message: "Please generate a password first." });
      return;
    }
    navigator.clipboard.writeText(formData.password);
    toast({ type: "success", message: "Temporary password copied to clipboard!" });
  };

  // --- ACTION: REGISTER ---
  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.password || !formData.role) {
      toast({ type: "error", message: "Please complete all required fields before saving." });
      return;
    }
    setIsLoading(true);
    try {
      const result = await registerUserAction(formData);
      if (result?.error) {
        toast({ type: "error", message: result.error });
      } else {
        toast({ type: "success", message: `Successfully registered ${formData.fullName}.` });
        setFormData({ fullName: "", email: "", password: "", role: "" });
        setIsAddModalOpen(false);
        fetchUsers();
      }
    } catch (error) {
      toast({ type: "error", message: "Failed to register user." });
    } finally {
      setIsLoading(false);
    }
  };

  // --- ACTION: EDIT ---
  const openEditModal = (user: any) => {
    setEditData({ 
      id: user.id, 
      fullName: user.full_name || "", 
      email: user.email || "", 
      role: user.role || "Staff" 
    });
    setIsEditModalOpen(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await updateUserAction(editData);
      if (result?.error) {
        toast({ type: "error", message: result.error });
      } else {
        toast({ type: "success", message: "User profile updated successfully." });
        setIsEditModalOpen(false);
        fetchUsers();
      }
    } catch (err) {
      toast({ type: "error", message: "Failed to update user." });
    } finally {
      setIsLoading(false);
    }
  };

  // --- ACTION: TOGGLE STATUS ---
  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const isCurrentlyActive = currentStatus !== 'Inactive';
    toast({ type: "success", message: `${isCurrentlyActive ? 'Suspending' : 'Restoring'} user access...` });
    
    try {
      const result = await toggleUserStatusAction(userId, currentStatus || 'Active');
      if (result?.error) {
        toast({ type: "error", message: result.error });
      } else {
        toast({ type: "success", message: `Account is now ${result.newStatus}.` });
        fetchUsers();
      }
    } catch (err) {
      toast({ type: "error", message: "Failed to change account status." });
    }
  };

  return (
    <div className="w-full flex flex-col space-y-6 animate-in fade-in duration-300 min-h-[calc(100vh-8rem)]">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">User Management</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">Manage employee access, corporate identities, and system roles.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-semibold shadow-sm">
            <Download className="w-4 h-4" />
            Export List
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        <div className="p-4 border-b border-slate-100 shrink-0 flex items-center justify-between">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
            />
          </div>
          {isFetching && <Loader2 className="w-4 h-4 animate-spin text-slate-300 mr-2" />}
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] uppercase tracking-[0.1em] text-slate-500 font-bold">
                <th className="py-4 px-6 font-semibold">User Details</th>
                <th className="py-4 px-6 font-semibold">System Role</th>
                <th className="py-4 px-6 font-semibold">Account Status</th>
                <th className="py-4 px-6 font-semibold">Password Status</th>
                <th className="py-4 px-6 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableData.length === 0 && !isFetching ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                        <Users className="w-8 h-8 text-slate-300" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900 tracking-tight">No users found</h3>
                      <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                        Your directory is currently empty. Click the "Add User" button above to register your first staff member.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                tableData.map((user) => {
                  const isActive = user.status !== 'Inactive';

                  return (
                    <tr key={user.id} className={`transition-colors group ${isActive ? 'hover:bg-slate-50/80' : 'bg-slate-50/50 opacity-60 hover:opacity-100'}`}>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs border ${isActive ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-200 text-slate-400 border-slate-300'}`}>
                            {user.full_name?.charAt(0) || "?"}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900 text-sm">{user.full_name}</span>
                            <span className="text-xs text-slate-500">{user.email || "Pending Email"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {/* UPDATED: Added styling specifically for the Distributor role */}
                        <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold ${
                          user.role === 'Super Admin' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                          user.role === 'Manager' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          user.role === 'Distributor' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                          'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold border ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {user.requires_password_change ? (
                          <span className="flex items-center gap-1.5 text-amber-600 font-medium text-xs">
                            <AlertCircle className="w-3.5 h-3.5" /> Pending Reset
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-emerald-600 font-medium text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEditModal(user)} className="p-1.5 text-slate-400 hover:text-slate-900 border border-transparent hover:bg-slate-100 hover:border-slate-200 rounded-md transition-colors" title="Edit User">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleToggleStatus(user.id, user.status)} className={`p-1.5 rounded-md transition-colors border border-transparent ${isActive ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200' : 'text-rose-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200'}`} title={isActive ? "Suspend User" : "Restore User"}>
                            {isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
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

        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white shrink-0">
          <p className="text-sm text-slate-500">
            Showing <span className="font-semibold text-slate-900">{tableData.length > 0 ? 1 : 0}</span> to <span className="font-semibold text-slate-900">{tableData.length}</span> of <span className="font-semibold text-slate-900">{tableData.length}</span> users
          </p>
          <div className="flex items-center gap-4">
            <button className="px-3 py-1 border border-slate-200 rounded text-slate-400 disabled:opacity-50" disabled>&lt;</button>
            <span className="text-sm text-slate-600">Page 1 of 1</span>
            <button className="px-3 py-1 border border-slate-200 rounded text-slate-400 disabled:opacity-50" disabled>&gt;</button>
          </div>
        </div>
      </div>

      {/* --- ADD USER MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Register New User</h3>
                <p className="text-sm text-slate-500 mt-1">Create an account and assign enterprise access.</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleRegisterUser} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Full Name <span className="text-rose-500">*</span></label>
                  <input type="text" required disabled={isLoading} value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all" placeholder="Jane Doe" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Corporate Email <span className="text-rose-500">*</span></label>
                  <input type="email" required disabled={isLoading} value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all" placeholder="jane@lamelin.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Temporary Password <span className="text-rose-500">*</span></label>
                  <div className="relative flex items-center">
                    <input type="text" readOnly required value={formData.password} className="w-full pl-3 pr-20 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-700" placeholder="Click generate" />
                    <div className="absolute right-1 flex gap-0.5">
                      <button type="button" onClick={generatePassword} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Generate Password"><RefreshCw className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={copyToClipboard} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Copy to Clipboard"><Copy className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">System Role <span className="text-rose-500">*</span></label>
                  <select required disabled={isLoading} value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all appearance-none">
                    <option value="" disabled>Select a role...</option>
                    <option value="Staff">Staff</option>
                    <option value="Manager">Manager</option>
                    <option value="Super Admin">Super Admin</option>
                    {/* UPDATED: Distributor added to options */}
                    <option value="Distributor">Distributor</option>
                  </select>
                </div>
              </div>
              <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
                <Shield className="w-5 h-5 shrink-0 text-blue-600" />
                <p className="text-sm text-blue-900 font-medium">New users will be forced to change this temporary password immediately upon their first login.</p>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={isLoading} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 shadow-sm">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Confirm & Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT USER MODAL --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit User Profile</h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditUser} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Full Name</label>
                <input type="text" required disabled={isLoading} value={editData.fullName} onChange={(e) => setEditData({...editData, fullName: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Corporate Email</label>
                <input type="email" required disabled={isLoading} value={editData.email} onChange={(e) => setEditData({...editData, email: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">System Role</label>
                <select required disabled={isLoading} value={editData.role} onChange={(e) => setEditData({...editData, role: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all appearance-none">
                  <option value="Staff">Staff</option>
                  <option value="Manager">Manager</option>
                  <option value="Super Admin">Super Admin</option>
                  {/* UPDATED: Distributor added to edit options */}
                  <option value="Distributor">Distributor</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={isLoading} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 shadow-sm">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}