"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, Eye, ReceiptText, Ban, Download, TrendingUp, CreditCard, Banknote, Smartphone, XCircle, Tag, AlertTriangle, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getRetailSalesAction, voidTransactionAction } from "@/lib/actions/pos";

export default function RetailSalesDashboard() {
  const { toast } = useToast();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Filters (Date Range)
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState(""); 
  const [endDate, setEndDate] = useState(""); 
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modal State
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const fetchOrders = async () => {
    setIsFetching(true);
    try {
      const res = await getRetailSalesAction();
      if (res.error) throw new Error(res.error);
      
      setOrders(res.data || []);
    } catch (error: any) {
      toast({ type: "error", message: "Failed to load retail sales." });
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, startDate, endDate]);

  const filteredOrders = orders.filter(order => {
    const customerName = order.customers?.full_name || order.customer_name || 'Walk-In Customer';
    
    const matchesSearch = 
      order.receipt_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.invoice_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.cashier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.reference_number && order.reference_number.toLowerCase().includes(searchQuery.toLowerCase())); // Search by ref number too!
      
    let matchesDate = true;
    if (startDate || endDate) {
      const orderDate = new Date(order.created_at).toISOString().split('T')[0];
      if (startDate && !endDate) matchesDate = orderDate >= startDate;
      else if (!startDate && endDate) matchesDate = orderDate <= endDate;
      else matchesDate = orderDate >= startDate && orderDate <= endDate;
    }

    return matchesSearch && matchesDate;
  });

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExportCSV = () => {
    // UPGRADED: Added Reference Number to the CSV export!
    const headers = ["Receipt No", "Date", "Customer", "Cashier", "Payment Method", "Provider", "Ref Number", "Subtotal", "Discount", "Grand Total", "Status"];
    const rows = filteredOrders.map(o => [
      o.receipt_number || o.invoice_no || o.id,
      new Date(o.created_at).toLocaleString(),
      o.customers?.full_name || o.customer_name || 'Walk-In',
      o.cashier_name,
      o.payment_method,
      o.payment_provider || '',
      o.reference_number || '',
      o.subtotal,
      o.discount_amount,
      o.grand_total,
      o.is_voided ? 'Voided' : 'Completed'
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Retail_Sales_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleVoidTransaction = async (orderId: string, receiptNumber: string) => {
    if (!confirm("Are you sure you want to void this transaction? This will return the items to inventory.")) return;
    
    setIsLoading(true);
    try {
      const res = await voidTransactionAction(orderId, receiptNumber);
      if (res.error) throw new Error(res.error);

      toast({ type: "success", message: "Transaction successfully voided." });
      
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, is_voided: true } : o));
      if (selectedOrder) setSelectedOrder({ ...selectedOrder, is_voided: true });
      
    } catch (err: any) {
      toast({ type: "error", message: err.message || "Failed to void transaction." });
    } finally {
      setIsLoading(false);
    }
  };

  const getPaymentIcon = (method: string) => {
    const m = method?.toLowerCase() || '';
    if (m.includes('cash')) return <Banknote className="w-3.5 h-3.5 text-emerald-600" />;
    if (m.includes('card')) return <CreditCard className="w-3.5 h-3.5 text-indigo-600" />;
    return <Smartphone className="w-3.5 h-3.5 text-blue-600" />; 
  };

  const validOrders = orders.filter(o => !o.is_voided);
  const voidedOrders = orders.filter(o => o.is_voided);
  
  const netRevenue = validOrders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);
  const voidedAmount = voidedOrders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);

  return (
    <div className="w-full flex flex-col space-y-4 animate-in fade-in duration-300 min-h-[calc(100vh-8rem)]">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Retail Sales History</h2>
          </div>
          <p className="text-[13px] text-slate-500 mt-0.5">View, audit, and void completed POS transactions.</p>
        </div>
        <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-semibold shadow-sm">
          <Download className="w-4 h-4 text-slate-500" /> Export to CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div><p className="text-[13px] font-medium text-slate-500">Valid Transactions</p><h3 className="text-2xl font-bold text-slate-900 mt-0.5">{validOrders.length}</h3></div>
          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600"><ReceiptText className="w-5 h-5" /></div>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-sm flex items-center justify-between bg-emerald-50/30">
          <div><p className="text-[13px] font-medium text-emerald-700">Net Revenue</p><h3 className="text-2xl font-bold text-emerald-600 mt-0.5">₱{netRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3></div>
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700"><TrendingUp className="w-5 h-5" /></div>
        </div>
        <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-sm flex items-center justify-between bg-rose-50/30">
          <div><p className="text-[13px] font-medium text-rose-700">Voided Amount</p><h3 className="text-2xl font-bold text-rose-600 mt-0.5">₱{voidedAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3></div>
          <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center text-rose-700"><Ban className="w-5 h-5" /></div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        
        <div className="p-3 border-b border-slate-100 shrink-0 flex flex-col lg:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search by receipt #, customer, ref code..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" />
          </div>
          
          <div className="flex items-center gap-2 w-full lg:w-auto bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400 ml-1 shrink-0" />
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="px-2 py-1 text-sm text-slate-600 outline-none bg-transparent w-full sm:w-auto"
            />
            <span className="text-slate-300 font-bold">-</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="px-2 py-1 text-sm text-slate-600 outline-none bg-transparent w-full sm:w-auto"
            />
            {(startDate || endDate) && (
              <button onClick={() => {setStartDate(""); setEndDate("");}} className="text-slate-400 hover:text-rose-500 transition-colors p-1" title="Clear Dates">
                <XCircle className="w-4 h-4" />
              </button>
            )}
            {isFetching && <Loader2 className="w-4 h-4 animate-spin text-slate-300 ml-2" />}
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] uppercase tracking-[0.1em] text-slate-500 font-bold">
                <th className="py-3 px-5">Receipt No.</th>
                <th className="py-3 px-5">Date & Time</th>
                <th className="py-3 px-5">Customer</th>
                <th className="py-3 px-5">Cashier</th>
                <th className="py-3 px-5">Payment Info</th>
                <th className="py-3 px-5 text-right">Total Amount</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 && !isFetching ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100"><ReceiptText className="w-8 h-8 text-slate-300" /></div>
                      <h3 className="text-base font-bold text-slate-900 tracking-tight">No transactions found</h3>
                      <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Try clearing your filters or wait for new sales to process.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => {
                  const customerName = order.customers?.full_name || order.customer_name || 'Walk-In Customer';
                  const isWalkIn = customerName === 'Walk-In Customer';
                  const hasDiscount = Number(order.discount_amount) > 0;
                  
                  return (
                    <tr key={order.id} className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${order.is_voided ? 'opacity-60 bg-slate-50' : ''}`} onClick={() => { setSelectedOrder(order); setIsViewModalOpen(true); }}>
                      <td className="py-3 px-5">
                        <span className={`px-2 py-1 rounded text-xs font-bold font-mono tracking-wider ${order.is_voided ? 'bg-slate-200 text-slate-500' : 'bg-blue-50 text-blue-700'}`}>
                          {order.receipt_number || order.invoice_no || order.id.split('-')[0].toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          <span className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">{new Date(order.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          {customerName}
                          {isWalkIn && <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-500 font-bold uppercase tracking-wider border border-slate-200">Default</span>}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-sm font-medium text-slate-600">
                        {order.cashier_name}
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
                            {getPaymentIcon(order.payment_method)}
                            {order.payment_method}
                          </span>
                          {order.payment_provider && (
                            <span className="text-[10px] text-slate-500 font-medium">{order.payment_provider}</span>
                          )}
                          {/* UPGRADED: Display reference number in the main table */}
                          {order.reference_number && (
                            <span className="text-[10px] text-slate-400 font-mono font-medium">Ref: {order.reference_number}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center justify-end gap-2">
                            <span className={`text-sm font-black ${order.is_voided ? 'text-slate-500 line-through' : 'text-slate-900'}`}>₱{Number(order.grand_total).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            {order.is_voided && <Ban className="w-4 h-4 text-rose-500" />}
                          </div>
                          {hasDiscount && !order.is_voided && <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600">Discounted</span>}
                        </div>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setIsViewModalOpen(true); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors inline-flex"
                          title="View Receipt Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!isFetching && filteredOrders.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white text-sm text-slate-500 shrink-0">
            <div>Showing <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredOrders.length)}</span> of <span className="font-bold text-slate-900">{filteredOrders.length}</span> sales</div>
            <div className="flex items-center gap-4">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 font-medium">Previous</button>
              <span className="font-medium text-slate-900 text-xs">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 font-medium">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* --- RECEIPT DETAILS SLIDE-OUT MODAL --- */}
      {isViewModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/40 backdrop-blur-sm transition-all duration-300">
          <div className="absolute inset-0" onClick={() => setIsViewModalOpen(false)} />
          
          <div className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300">
            
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight font-mono">
                    {selectedOrder.receipt_number || selectedOrder.invoice_no || selectedOrder.id.split('-')[0].toUpperCase()}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">{new Date(selectedOrder.created_at).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                </div>
                <button onClick={() => setIsViewModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-lg transition-colors">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              
              {selectedOrder.is_voided && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 text-rose-700 rounded-lg border border-rose-200">
                  <Ban className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">This Receipt is Voided</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Customer</p>
                  <p className="text-sm font-bold text-slate-900">
                    {selectedOrder.customers?.full_name || selectedOrder.customer_name || 'Walk-In Customer'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Cashier</p>
                  <p className="text-sm font-medium text-slate-700">{selectedOrder.cashier_name}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Payment Method</p>
                  <p className="text-sm font-medium text-slate-700 uppercase flex items-center gap-2">
                    {selectedOrder.payment_method} 
                    {selectedOrder.payment_provider && <span className="text-xs text-slate-400 normal-case border-l border-slate-300 pl-2">({selectedOrder.payment_provider})</span>}
                  </p>
                  {/* UPGRADED: Display Reference Number in the Slide Out Drawer */}
                  {selectedOrder.reference_number && (
                    <p className="text-xs text-slate-500 font-mono mt-1">Ref No: <span className="font-bold text-slate-800">{selectedOrder.reference_number}</span></p>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Line Items</p>
                
                <div className="space-y-3">
                  {selectedOrder.order_items && selectedOrder.order_items.length > 0 ? (
                    selectedOrder.order_items.map((item: any) => {
                      const itemName = item.inventory_items?.name || item.name || item.product_name || 'Unknown Product';
                      const itemPrice = Number(item.price_at_time || item.price || 0);

                      return (
                        <div key={item.id} className="flex justify-between items-start">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0 mt-0.5">
                              {item.quantity}x
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 leading-tight">{itemName}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">₱{itemPrice.toLocaleString()} ea</p>
                            </div>
                          </div>
                          <p className="text-sm font-bold text-slate-900">₱{(itemPrice * item.quantity).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800">
                        Line items were not saved to the database for this specific transaction. This is common for old test data. New POS transactions will appear normally.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 space-y-2">
              <div className="flex justify-between items-center text-sm font-medium text-slate-500">
                <span>Subtotal</span>
                <span>₱{Number(selectedOrder.subtotal).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              
              {Number(selectedOrder.discount_amount) > 0 && (
                <div className="flex justify-between items-center text-sm font-bold text-emerald-600">
                  <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Discount</span>
                  <span>-₱{Number(selectedOrder.discount_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 mt-2 mb-4">
                <span className="text-base font-bold text-slate-900">Grand Total</span>
                <span className="text-2xl font-black text-slate-900 tracking-tight">₱{Number(selectedOrder.grand_total).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>

              {!selectedOrder.is_voided && (
                <button 
                  onClick={() => handleVoidTransaction(selectedOrder.id, selectedOrder.receipt_number || selectedOrder.id)}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white border-2 border-rose-100 text-rose-600 font-bold rounded-xl hover:bg-rose-50 hover:border-rose-200 transition-colors"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                  Void Transaction
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}