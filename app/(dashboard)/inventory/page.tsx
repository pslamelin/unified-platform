"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Package, AlertCircle, ArrowUpRight, ArrowDownRight, Loader2, Clock, History, X, ChevronLeft, ChevronRight, Upload, Download, FileText, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/ui/image-upload";
import { getInventoryAction, createSkuAction, adjustStockAction, getExpiringBatchesAction, getSkuHistoryAction, bulkImportSkusAction } from "@/lib/actions/inventory"; // <-- NEW IMPORT ADDED HERE
import { createBrowserClient } from "@supabase/ssr";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function InventoryDashboard() {
  const { toast } = useToast();
  
  const [inventory, setInventory] = useState<any[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Search & Pagination States
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modal States for Create & Edit
  const [isSkuModalOpen, setIsSkuModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [selectedSku, setSelectedSku] = useState<any>(null);

  // History State
  const [skuHistory, setSkuHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Unified Form State
  const [skuForm, setSkuForm] = useState({ 
    sku: "", 
    name: "", 
    category: "", 
    lowStockThreshold: "10",
    sellingPrice: "",
    cost: "",
    imageUrl: ""
  });
  
  const [adjustForm, setAdjustForm] = useState({ type: "IN", quantity: "", expiryDate: "", notes: "" });
  const [doesNotExpire, setDoesNotExpire] = useState(false);

  const fetchInventory = async () => {
    setIsFetching(true);
    try {
      const response = await getInventoryAction();
      if (response.error) throw new Error(response.error);
      setInventory(response.data || []);

      const expiryRes = await getExpiringBatchesAction();
      if (!expiryRes.error && expiryRes.data) {
        setExpiringBatches(expiryRes.data);
      }
    } catch (error: any) {
      toast({ type: "error", message: "Failed to load inventory." });
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredInventory.length / itemsPerPage));
  const paginatedInventory = filteredInventory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- CSV BULK IMPORT LOGIC ---
  const handleDownloadTemplate = () => {
    const headers = "SKU,Product Name,Category,Cost,Selling Price,Low Stock Threshold,Initial Quantity,Expiry Date (YYYY-MM-DD)\n";
    const sampleRow1 = "SKU-00005,Premium Massage Oil,Massage Oils,200.00,500.00,10,50,2026-12-31\n";
    const sampleRow2 = "SKU-00006,Anti-Aging Serum,Facial Products,450.00,1200.00,5,0,\n"; 
    
    const blob = new Blob([headers + sampleRow1 + sampleRow2], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Prettyskin_Inventory_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const csvText = event.target?.result as string;
        const lines = csvText.split('\n').filter(line => line.trim().length > 0);
        
        if (lines.length < 2) throw new Error("CSV is empty or missing data rows.");

        const newItems = [];
        const initialStockData = [];
        
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, '')); 
          
          if (cols.length >= 6 && cols[0]) {
            const initialQty = cols.length >= 7 ? (Number(cols[6]) || 0) : 0;
            
            let expiryDate = null;
            if (cols.length >= 8 && cols[7]) {
              const parsedDate = new Date(cols[7]);
              if (!isNaN(parsedDate.getTime())) {
                expiryDate = parsedDate.toISOString().split('T')[0];
              }
            }

            newItems.push({
              sku: cols[0].toUpperCase(),
              name: cols[1],
              category: cols[2],
              cost: Number(cols[3]) || 0,
              selling_price: Number(cols[4]) || 0,
              low_stock_threshold: Number(cols[5]) || 0,
              current_quantity: initialQty,
              image_url: cols.length >= 9 && cols[8] ? cols[8] : null // <-- NEW LINE TO READ IMAGES
            });

            initialStockData.push({
              sku: cols[0].toUpperCase(),
              quantity: initialQty,
              expiryDate: expiryDate
            });
          }
        }

        if (newItems.length === 0) throw new Error("No valid rows found in CSV.");

        // FIXED: Now we send the array to the secure backend action to bypass RLS!
        const res = await bulkImportSkusAction(newItems, initialStockData);

        if (res.error) {
          throw new Error(res.error);
        }

        toast({ type: "success", message: `Successfully imported ${res.count} products!` });
        setIsBulkImportOpen(false);
        fetchInventory();
      } catch (err: any) {
        toast({ type: "error", message: err.message || "Failed to process CSV file." });
      } finally {
        setIsLoading(false);
        if (e.target) e.target.value = ''; 
      }
    };
    reader.readAsText(file);
  };

  // --- SKU MANAGEMENT ACTIONS ---
  
  const openAddSkuModal = () => {
    let nextNumber = 1;
    if (inventory.length > 0) {
      const skuNumbers = inventory.map(item => {
        const match = item.sku.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      });
      nextNumber = Math.max(...skuNumbers) + 1;
    }
    const sequentialSku = `SKU-${nextNumber.toString().padStart(5, '0')}`;
    
    setModalMode('create');
    setEditingId(null);
    setSkuForm({ sku: sequentialSku, name: "", category: "", lowStockThreshold: "10", sellingPrice: "", cost: "", imageUrl: "" });
    setIsSkuModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setModalMode('edit');
    setEditingId(item.id);
    setSkuForm({
      sku: item.sku || "",
      name: item.name || "",
      category: item.category || "",
      lowStockThreshold: String(item.low_stock_threshold || "0"),
      sellingPrice: String(item.selling_price || "0"),
      cost: String(item.cost || "0"),
      imageUrl: item.image_url || ""
    });
    setIsSkuModalOpen(true);
  };

  const handleSaveSku = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skuForm.sku || !skuForm.name || !skuForm.category || !skuForm.cost || !skuForm.sellingPrice) {
      return toast({ type: "error", message: "Please fill in all required fields." });
    }
    
    setIsLoading(true);
    try {
      if (modalMode === 'create') {
        const res = await createSkuAction(skuForm);
        if (res?.error) throw new Error(res.error);
        toast({ type: "success", message: `Successfully registered SKU: ${skuForm.sku}` });
      } else {
        const { error } = await supabase
          .from('inventory_items')
          .update({
            name: skuForm.name,
            category: skuForm.category,
            cost: Number(skuForm.cost),
            selling_price: Number(skuForm.sellingPrice),
            low_stock_threshold: Number(skuForm.lowStockThreshold),
            image_url: skuForm.imageUrl
          })
          .eq('id', editingId);

        if (error) throw error;
        toast({ type: "success", message: `Successfully updated ${skuForm.name}` });
      }
      
      setIsSkuModalOpen(false);
      fetchInventory();
    } catch (err: any) {
      toast({ type: "error", message: err.message || "An unexpected error occurred." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustForm.quantity || parseInt(adjustForm.quantity) <= 0) return toast({ type: "error", message: "Enter a valid quantity." });
    if (adjustForm.type === "IN" && !doesNotExpire && !adjustForm.expiryDate) return toast({ type: "error", message: "Expiry Date is mandatory unless marked as non-expiring." });

    setIsLoading(true);
    try {
      const payload = {
        skuId: selectedSku.id,
        type: adjustForm.type,
        quantity: adjustForm.quantity,
        expiryDate: (adjustForm.type === 'IN' && !doesNotExpire) ? adjustForm.expiryDate : null,
        notes: adjustForm.notes,
        userId: null
      };

      const res = await adjustStockAction(payload);
      if (res?.error) throw new Error(res.error);
      toast({ type: "success", message: `Successfully logged ${adjustForm.type === 'IN' ? 'Stock In' : 'Pull Out'} for ${selectedSku.name}` });
      setIsAdjustStockOpen(false);
      fetchInventory();
    } catch (err: any) {
      toast({ type: "error", message: err.message || "An unexpected error occurred." });
    } finally {
      setIsLoading(false);
    }
  };

  const openAdjustModal = (item: any, type: "IN" | "PULL_OUT") => {
    setSelectedSku(item);
    setAdjustForm({ type, quantity: "", expiryDate: "", notes: "" });
    setDoesNotExpire(false);
    setIsAdjustStockOpen(true);
  };

  const openHistoryModal = async (item: any) => {
    setSelectedSku(item);
    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    setSkuHistory([]);
    try {
      const res = await getSkuHistoryAction(item.id);
      if (res.data) setSkuHistory(res.data);
    } catch (err) {
      toast({ type: "error", message: "Failed to load ledger history." });
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const totalItems = inventory.length;
  const lowStockItems = inventory.filter(i => {
    const isService = i.category.includes("Service") || i.category.includes("Treatment") || i.category === "Packages";
    return !isService && i.current_quantity <= i.low_stock_threshold;
  }).length;

  return (
    <div className="w-full flex flex-col space-y-4 animate-in fade-in duration-300 min-h-[calc(100vh-8rem)]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Inventory Ledger</h2>
          </div>
          <p className="text-[13px] text-slate-500 mt-0.5">Manage SKUs, log stock movements, and monitor expirations.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsBulkImportOpen(true)} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-semibold shadow-sm">
            <Upload className="w-4 h-4 text-slate-500" /> Bulk Import
          </button>
          <button onClick={openAddSkuModal} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold shadow-sm">
            <Plus className="w-4 h-4" /> Register New SKU
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-slate-500">Total Active SKUs</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{totalItems}</h3>
          </div>
          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600"><Package className="w-5 h-5" /></div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-slate-500">Low Stock Alerts</p>
            <h3 className="text-2xl font-bold text-rose-600 mt-0.5">{lowStockItems}</h3>
          </div>
          <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center text-rose-600"><AlertCircle className="w-5 h-5" /></div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-slate-500">Expiring &lt; 6 Months</p>
            <h3 className={`text-2xl font-bold mt-0.5 ${expiringBatches.length > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {expiringBatches.length} <span className="text-xs font-medium text-slate-500">batches</span>
            </h3>
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${expiringBatches.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        <div className="p-3 border-b border-slate-100 shrink-0 flex items-center justify-between bg-slate-50/50">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search by SKU, Product Name, or Category..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm" />
          </div>
          {isFetching && <Loader2 className="w-4 h-4 animate-spin text-slate-300 mr-2" />}
        </div>

        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] uppercase tracking-[0.1em] text-slate-500 font-bold">
                <th className="py-3 px-5">Product Details</th>
                <th className="py-3 px-5 text-center">Category</th>
                <th className="py-3 px-5 text-right">Current Qty</th>
                <th className="py-3 px-5 text-center">Status</th>
                <th className="py-3 px-5 text-right">Log Transaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventory.length === 0 && !isFetching ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100"><Package className="w-8 h-8 text-slate-300" /></div>
                      <h3 className="text-base font-bold text-slate-900 tracking-tight">No records found</h3>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedInventory.map((item) => {
                  const isService = item.category.includes("Service") || item.category.includes("Treatment") || item.category === "Packages";
                  const isLowStock = !isService && item.current_quantity <= item.low_stock_threshold;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-slate-400" />}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                            <span className="text-[11px] text-slate-500 font-mono mt-0.5">SKU: {item.sku}</span>
                            <span className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">Cost: ₱{item.cost || '0.00'} <span className="mx-1">•</span> Price: <span className="text-emerald-600">₱{item.selling_price || '0.00'}</span></span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5 text-center">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">{item.category}</span>
                      </td>
                      <td className="py-3 px-5 text-right">
                        {isService ? <span className="text-2xl font-black text-slate-300" title="Unlimited Quantity">∞</span> : <span className={`text-base font-black ${isLowStock ? 'text-rose-600' : 'text-slate-900'}`}>{item.current_quantity}</span>}
                      </td>
                      <td className="py-3 px-5 text-center">
                        {isService ? <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">Service</span> : isLowStock ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-100"><AlertCircle className="w-3 h-3" /> Low Stock</span> : <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">Healthy</span>}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isService && (
                            <>
                              <button onClick={() => openAdjustModal(item, "IN")} className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors text-[11px] font-bold shadow-sm" title="Stock In"><ArrowUpRight className="w-3.5 h-3.5" /> IN</button>
                              <button onClick={() => openAdjustModal(item, "PULL_OUT")} className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-[11px] font-bold shadow-sm" title="Pull Out / Stock Out"><ArrowDownRight className="w-3.5 h-3.5" /> OUT</button>
                            </>
                          )}
                          <button onClick={() => openEditModal(item)} className="p-1 text-slate-400 hover:text-blue-600 border border-transparent hover:bg-blue-50 hover:border-blue-200 rounded-md transition-colors ml-1" title="Edit SKU Details"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => openHistoryModal(item)} className="p-1 text-slate-400 hover:text-blue-600 border border-transparent hover:bg-blue-50 hover:border-blue-200 rounded-md transition-colors" title="View Audit Ledger"><History className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!isFetching && filteredInventory.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white text-sm text-slate-500 shrink-0">
            <div>Showing <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredInventory.length)}</span> of <span className="font-bold text-slate-900">{filteredInventory.length}</span> items</div>
            <div className="flex items-center gap-4">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><ChevronLeft className="w-5 h-5" /></button>
              <span className="font-medium text-slate-900 text-xs">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>
        )}
      </div>

      {/* --- MODAL: BULK IMPORT CSV --- */}
      {isBulkImportOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Upload className="w-5 h-5 text-blue-600" /> Bulk Import SKUs</h3>
              <button onClick={() => setIsBulkImportOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-900">Step 1: Download the Template</p>
                <p className="text-xs text-slate-500 leading-relaxed">Download our properly formatted CSV template. Do not change the column headers or order. You can now define the <span className="font-bold text-slate-900">Initial Quantity</span> and <span className="font-bold text-slate-900">Expiry Date</span>.</p>
                <button onClick={handleDownloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-bold text-sm rounded-lg hover:bg-slate-200 transition-colors w-full justify-center border border-slate-200">
                  <Download className="w-4 h-4" /> Download CSV Template
                </button>
              </div>

              <div className="border-t border-dashed border-slate-200"></div>

              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-900">Step 2: Upload Filled File</p>
                <p className="text-xs text-slate-500 leading-relaxed">Upload your completed `.csv` file here. Ensure dates are formatted exactly as <span className="font-mono bg-slate-100 px-1 rounded text-slate-700">YYYY-MM-DD</span>.</p>
                
                <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${isLoading ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'border-blue-300 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-400'}`}>
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {isLoading ? (
                      <Loader2 className="w-8 h-8 text-blue-600 mb-2 animate-spin" />
                    ) : (
                      <FileText className="w-8 h-8 text-blue-500 mb-2 opacity-70" />
                    )}
                    <p className="text-sm font-bold text-blue-700">{isLoading ? 'Processing...' : 'Click to select CSV file'}</p>
                  </div>
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={isLoading} />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- UPGRADED MODAL: CREATE / EDIT SKU --- */}
      {isSkuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {modalMode === 'create' ? 'Register New SKU' : 'Edit SKU Details'}
                </h3>
              </div>
              <button onClick={() => setIsSkuModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <form onSubmit={handleSaveSku} className="p-6 space-y-5">
              
              <div className="flex gap-5 items-center">
                <ImageUpload value={skuForm.imageUrl} onChange={(url) => setSkuForm({...skuForm, imageUrl: url})} disabled={isLoading} />
                <div className="flex-1">
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">Product Name <span className="text-rose-500">*</span></label>
                  <input type="text" required disabled={isLoading} value={skuForm.name} onChange={e => setSkuForm({...skuForm, name: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm" placeholder="e.g. Aloe Vera Soothing Gel" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5 border-t border-slate-100 pt-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">SKU Code (Read-Only)</label>
                  <input type="text" readOnly disabled={isLoading} value={skuForm.sku} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono uppercase text-slate-500 cursor-not-allowed" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Category <span className="text-rose-500">*</span></label>
                  <select required disabled={isLoading} value={skuForm.category} onChange={e => setSkuForm({...skuForm, category: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm appearance-none">
                    <option value="" disabled>Select...</option>
                    <option value="Body Treatments">Body Treatments</option>
                    <option value="Facial Products">Facial Products</option>
                    <option value="Facial Treatments">Facial Treatments</option>
                    <option value="Hair Products">Hair Products</option>
                    <option value="Hair Services">Hair Services</option>
                    <option value="Massage Oils">Massage Oils</option>
                    <option value="Massage Services">Massage Services</option>
                    <option value="Nail Services">Nail Services</option>
                    <option value="Nail Supplies">Nail Supplies</option>
                    <option value="Packages">Packages</option>
                    <option value="Waxing / Removal">Waxing / Removal</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5 border-t border-slate-100 pt-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Cost (₱) <span className="text-rose-500">*</span></label>
                  <input type="number" step="0.01" min="0" required disabled={isLoading} value={skuForm.cost} onChange={e => setSkuForm({...skuForm, cost: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm" placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Selling Price (₱) <span className="text-rose-500">*</span></label>
                  <input type="number" step="0.01" min="0" required disabled={isLoading} value={skuForm.sellingPrice} onChange={e => setSkuForm({...skuForm, sellingPrice: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm" placeholder="0.00" />
                </div>
              </div>

              <div className="space-y-1.5 border-t border-slate-100 pt-5">
                <label className="text-sm font-medium text-slate-700">Low Stock Alert Threshold</label>
                <input type="number" min="0" required disabled={isLoading} value={skuForm.lowStockThreshold} onChange={e => setSkuForm({...skuForm, lowStockThreshold: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm" />
                <p className="text-xs text-slate-500">System will flag this item if quantity drops below this number.</p>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsSkuModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={isLoading} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} 
                  {modalMode === 'create' ? 'Register SKU' : 'Update SKU'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: ADJUST STOCK LOG --- */}
      {isAdjustStockOpen && selectedSku && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className={`flex items-center justify-between p-6 border-b border-slate-100 ${adjustForm.type === 'IN' ? 'bg-emerald-50/50' : 'bg-rose-50/50'}`}>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Log {adjustForm.type === 'IN' ? 'Stock In' : 'Pull Out'}
                </h3>
                <p className="text-sm text-slate-500 mt-1 font-mono">{selectedSku.sku} - {selectedSku.name}</p>
              </div>
              <button onClick={() => setIsAdjustStockOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <form onSubmit={handleAdjustStock} className="p-6 space-y-5">
              
              <div className={`grid ${adjustForm.type === 'IN' ? 'grid-cols-2' : 'grid-cols-1'} gap-5`}>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Quantity <span className="text-rose-500">*</span></label>
                  <input type="number" min="1" required disabled={isLoading} value={adjustForm.quantity} onChange={e => setAdjustForm({...adjustForm, quantity: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm font-bold" placeholder="e.g. 50" />
                </div>
                
                {adjustForm.type === 'IN' && (
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-sm font-medium text-slate-700">
                      Batch Expiry Date {!doesNotExpire && <span className="text-rose-500">*</span>}
                    </label>
                    
                    {doesNotExpire ? (
                      <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-400 italic flex items-center h-[38px]">
                        No expiration tracked
                      </div>
                    ) : (
                      <DatePicker
                        selected={adjustForm.expiryDate ? new Date(adjustForm.expiryDate + 'T12:00:00') : null}
                        onChange={(date: Date | null) => {
                          if (!date) {
                            setAdjustForm({ ...adjustForm, expiryDate: "" });
                            return;
                          }
                          const formatted = date.toISOString().split('T')[0];
                          setAdjustForm({ ...adjustForm, expiryDate: formatted });
                        }}
                        minDate={new Date()}
                        disabled={isLoading}
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                        placeholderText="Select date..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm disabled:opacity-50 disabled:bg-slate-50"
                        wrapperClassName="w-full"
                      />
                    )}

                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-900 transition-colors pt-1 w-max">
                      <input type="checkbox" checked={doesNotExpire} onChange={e => setDoesNotExpire(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5" />
                      Item does not expire
                    </label>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Reason / Notes (Optional)</label>
                <textarea disabled={isLoading} value={adjustForm.notes} onChange={e => setAdjustForm({...adjustForm, notes: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 text-sm resize-none" rows={2} placeholder={adjustForm.type === 'IN' ? "e.g. Received from Supplier X" : "e.g. Damaged box, removed from floor"}></textarea>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-4 rounded-lg flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">New Total Quantity will be:</span>
                <span className="text-lg font-black text-slate-900">
                  {selectedSku.current_quantity + (adjustForm.quantity ? (adjustForm.type === 'IN' ? parseInt(adjustForm.quantity) : -parseInt(adjustForm.quantity)) : 0)}
                </span>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="submit" disabled={isLoading} className={`w-full flex items-center justify-center gap-2 px-5 py-3 text-white text-sm font-bold rounded-lg transition-colors shadow-sm ${adjustForm.type === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} 
                  Confirm {adjustForm.type === 'IN' ? 'Stock In' : 'Pull Out'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: AUDIT LEDGER SLIDE-OUT --- */}
      {isHistoryOpen && selectedSku && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-slate-900/40 backdrop-blur-sm transition-all duration-300">
          <div className="absolute inset-0" onClick={() => setIsHistoryOpen(false)} />
          
          <div className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300">
            
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-600" />
                  Audit Ledger
                </h3>
                <p className="text-[13px] text-slate-500 mt-1 font-mono">{selectedSku.sku} - {selectedSku.name}</p>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              {isHistoryLoading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <p className="text-sm text-slate-500 font-medium">Retrieving secure ledger...</p>
                </div>
              ) : skuHistory.length === 0 ? (
                <div className="text-center py-10 flex flex-col items-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                    <History className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-900">No transactions yet</p>
                  <p className="text-xs text-slate-500 mt-1">Stock movements will appear here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {skuHistory.map((tx) => {
                    const isOutType = tx.transaction_type === 'OUT' || tx.transaction_type === 'PULL_OUT' || Number(tx.quantity_changed) < 0;
                    const noteText = tx.notes?.toLowerCase() || '';
                    const isPosSale = noteText.includes('sold via pos');
                    const isVoid = noteText.includes('voided');
                    
                    let actionLabel = isOutType ? 'Pull Out' : 'Stock In';
                    if (isPosSale) actionLabel = 'POS Sale';
                    if (isVoid) actionLabel = 'Void Return';
                    if (tx.transaction_type === 'INITIAL') actionLabel = 'Initial Stock';

                    const absQty = Math.abs(Number(tx.quantity_changed));
                    const isPositiveAction = actionLabel === 'Stock In' || actionLabel === 'Void Return' || actionLabel === 'Initial Stock';

                    return (
                      <div key={tx.id} className="flex gap-4 p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                        
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isPositiveAction ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {isPositiveAction ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <p className="text-sm font-bold text-slate-900">
                              {actionLabel}
                              <span className={`ml-2 text-[13px] font-black ${isPositiveAction ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isPositiveAction ? '+' : '-'}{absQty}
                              </span>
                            </p>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right shrink-0 ml-2">
                              {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          
                          {tx.notes && (
                            <p className="text-[13px] text-slate-600 mt-1.5 border-l-2 border-slate-200 pl-2">
                              "{tx.notes}"
                            </p>
                          )}
                          
                          {tx.expiry_date && (
                            <p className="text-[11px] text-amber-600 font-bold mt-2 flex items-center gap-1.5 bg-amber-50 w-max px-2 py-1 rounded-md">
                              <Clock className="w-3.5 h-3.5" /> 
                              Batch Exp: {new Date(tx.expiry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}