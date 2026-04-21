"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, Eye, Clock, Package, CheckCircle2, XCircle, FileText, TrendingUp, Truck, AlertCircle, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SalesHistoryDashboard() {
  const { toast } = useToast();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // View Modal State
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const fetchOrders = async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('b2b_orders')
        .select(`
          *,
          b2b_order_items (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      toast({ type: "error", message: "Failed to load sales history." });
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredOrders = orders.filter(order => 
    order.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.distributor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.status?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- UPGRADED INVENTORY DEDUCTION LOGIC ---
  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setIsLoading(true);
    try {
      const oldStatus = selectedOrder?.status;

      // 1. Update the order status in the database
      const { error } = await supabase
        .from('b2b_orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      // 2. IF MARKED COMPLETED: Deduct from Inventory & Log Audit
      if (newStatus === 'Completed' && oldStatus !== 'Completed' && selectedOrder && selectedOrder.b2b_order_items) {
        for (const item of selectedOrder.b2b_order_items) {
          const { data: stockData } = await supabase
            .from('inventory_items')
            .select('current_quantity, id')
            .eq('sku', item.sku)
            .single();

          if (stockData) {
            await supabase
              .from('inventory_items')
              .update({ current_quantity: stockData.current_quantity - item.quantity })
              .eq('id', stockData.id);

            await supabase
              .from('inventory_transactions')
              .insert([{
                sku_id: stockData.id,
                transaction_type: 'SALE',
                quantity_changed: item.quantity,
                notes: `B2B Wholesale Fulfilled (${selectedOrder.po_number})`
              }]);
          }
        }
      }

      // 3. IF CANCELLED AFTER COMPLETION: Return stock to Inventory!
      if (newStatus === 'Cancelled' && oldStatus === 'Completed' && selectedOrder && selectedOrder.b2b_order_items) {
        for (const item of selectedOrder.b2b_order_items) {
          const { data: stockData } = await supabase
            .from('inventory_items')
            .select('current_quantity, id')
            .eq('sku', item.sku)
            .single();

          if (stockData) {
            await supabase
              .from('inventory_items')
              .update({ current_quantity: stockData.current_quantity + item.quantity })
              .eq('id', stockData.id);

            await supabase
              .from('inventory_transactions')
              .insert([{
                sku_id: stockData.id,
                transaction_type: 'IN',
                quantity_changed: item.quantity,
                notes: `B2B Order Cancelled/Returned (${selectedOrder.po_number})`
              }]);
          }
        }
      }

      toast({ type: "success", message: `Order status updated to ${newStatus}` });
      
      // Update local state instantly
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder) setSelectedOrder({ ...selectedOrder, status: newStatus });
      
    } catch (err: any) {
      toast({ type: "error", message: err.message || "Failed to update order status." });
    } finally {
      setIsLoading(false);
    }
  };

  // --- NEW: EXPORT TO CSV ---
  const handleExportCSV = () => {
    const headers = ["PO Number", "Date", "Distributor", "Status", "Total Amount"];
    const rows = filteredOrders.map(o => [
      o.po_number,
      new Date(o.created_at).toLocaleString(),
      o.distributor_name || 'Unknown',
      o.status,
      o.total_amount
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `B2B_Orders_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toUpperCase() || 'PENDING';
    if (s === 'PENDING') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 uppercase tracking-wider"><Clock className="w-3 h-3" /> Pending</span>;
    if (s === 'PROCESSING') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 uppercase tracking-wider"><Package className="w-3 h-3" /> Processing</span>;
    if (s === 'READY') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 uppercase tracking-wider"><Truck className="w-3 h-3" /> Ready</span>;
    if (s === 'COMPLETED') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-wider"><CheckCircle2 className="w-3 h-3" /> Completed</span>;
    if (s === 'CANCELLED') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 uppercase tracking-wider"><XCircle className="w-3 h-3" /> Cancelled</span>;
    return <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">{s}</span>;
  };

  // Metrics
  const pendingCount = orders.filter(o => o.status === 'Pending').length;
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const thisMonthRevenue = orders
    .filter(o => o.status === 'Completed' && new Date(o.created_at).getMonth() === currentMonth && new Date(o.created_at).getFullYear() === currentYear)
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  return (
    <div className="w-full flex flex-col space-y-4 animate-in fade-in duration-300 min-h-[calc(100vh-8rem)]">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">B2B Fulfillment</h2>
          </div>
          <p className="text-[13px] text-slate-500 mt-0.5">Review incoming Purchase Orders, pack boxes, and track wholesale revenue.</p>
        </div>
        
        {/* EXPORT BUTTON MOVED HERE */}
        <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-semibold shadow-sm">
          <Download className="w-4 h-4 text-slate-500" /> Export B2B Data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div><p className="text-[13px] font-medium text-slate-500">Total Orders Logged</p><h3 className="text-2xl font-bold text-slate-900 mt-0.5">{orders.length}</h3></div>
          <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-600"><FileText className="w-5 h-5" /></div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div><p className="text-[13px] font-medium text-slate-500">Action Required (Pending)</p><h3 className={`text-2xl font-bold mt-0.5 ${pendingCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{pendingCount}</h3></div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${pendingCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}><AlertCircle className="w-5 h-5" /></div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div><p className="text-[13px] font-medium text-slate-500">Completed Revenue (This Month)</p><h3 className="text-2xl font-bold text-emerald-600 mt-0.5">₱{thisMonthRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3></div>
          <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600"><TrendingUp className="w-5 h-5" /></div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        <div className="p-3 border-b border-slate-100 shrink-0 flex items-center justify-between bg-slate-50/50">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search PO Number or Distributor..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" />
          </div>
          {isFetching && <Loader2 className="w-4 h-4 animate-spin text-slate-300 mr-2" />}
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] uppercase tracking-[0.1em] text-slate-500 font-bold">
                <th className="py-3 px-5">Date & PO Number</th>
                <th className="py-3 px-5">Distributor</th>
                <th className="py-3 px-5 text-center">Status</th>
                <th className="py-3 px-5 text-right">Grand Total</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 && !isFetching ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100"><Package className="w-8 h-8 text-slate-300" /></div>
                      <h3 className="text-base font-bold text-slate-900 tracking-tight">No orders found</h3>
                      <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">When distributors place orders in the Kiosk, they will appear here.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => { setSelectedOrder(order); setIsViewModalOpen(true); }}>
                    <td className="py-3 px-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 font-mono tracking-tight">{order.po_number}</span>
                        <span className="text-[11px] text-slate-500 mt-0.5">{new Date(order.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                          {(order.distributor_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-slate-900">{order.distributor_name || 'Unknown User'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-center">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <span className="text-sm font-black text-slate-900">₱{Number(order.total_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setIsViewModalOpen(true); }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors inline-flex"
                        title="View Order Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isFetching && filteredOrders.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white text-sm text-slate-500 shrink-0">
            <div>Showing <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredOrders.length)}</span> of <span className="font-bold text-slate-900">{filteredOrders.length}</span> orders</div>
            <div className="flex items-center gap-4">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 font-medium">Previous</button>
              <span className="font-medium text-slate-900 text-xs">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 font-medium">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* --- ORDER DETAILS SLIDE-OUT MODAL --- */}
      {isViewModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/40 backdrop-blur-sm transition-all duration-300">
          <div className="absolute inset-0" onClick={() => setIsViewModalOpen(false)} />
          
          <div className="relative bg-white w-full max-w-lg h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300">
            
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight font-mono">{selectedOrder.po_number}</h3>
                  <p className="text-xs text-slate-500 mt-1">{new Date(selectedOrder.created_at).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                </div>
                <button onClick={() => setIsViewModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-lg transition-colors">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Status:</span>
                {getStatusBadge(selectedOrder.status)}
              </div>

              {/* ACTION PIPELINE */}
              <div className="flex flex-col gap-2 p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Update Fulfillment Status</p>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => handleUpdateStatus(selectedOrder.id, 'Processing')} disabled={isLoading || selectedOrder.status === 'Processing'} className="py-2 text-[11px] font-bold rounded bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors">Processing</button>
                  <button onClick={() => handleUpdateStatus(selectedOrder.id, 'Ready')} disabled={isLoading || selectedOrder.status === 'Ready'} className="py-2 text-[11px] font-bold rounded bg-purple-50 text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition-colors">Ready</button>
                  <button onClick={() => handleUpdateStatus(selectedOrder.id, 'Completed')} disabled={isLoading || selectedOrder.status === 'Completed'} className="py-2 text-[11px] font-bold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3"/> Complete</button>
                </div>
                {selectedOrder.status !== 'Cancelled' && (
                  <button onClick={() => handleUpdateStatus(selectedOrder.id, 'Cancelled')} disabled={isLoading} className="mt-1 py-1.5 text-[10px] font-bold text-rose-500 hover:bg-rose-50 rounded transition-colors w-full">Cancel Order</button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              
              {selectedOrder.notes && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> Order Notes & Promos</p>
                  <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">{selectedOrder.notes}</p>
                </div>
              )}

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Line Items to Pack</p>
                
                {selectedOrder.b2b_order_items && selectedOrder.b2b_order_items.length > 0 ? (
                  selectedOrder.b2b_order_items.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-sm">
                          {item.quantity}x
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{item.product_name || item.name || 'Unknown Product'}</p>
                          <p className="text-[10px] font-mono text-slate-500">{item.sku}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-600">₱{Number(item.wholesale_price * item.quantity).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                        <p className="text-[10px] text-slate-400">₱{Number(item.wholesale_price).toLocaleString()} ea</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 italic">No line items found.</p>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-500">Grand Total</span>
              <span className="text-3xl font-black text-slate-900 tracking-tight">₱{Number(selectedOrder.total_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}