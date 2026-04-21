"use client";

import { useState, useEffect } from "react";
import { Search, ShoppingCart, Package, CheckCircle2, Loader2, Info, Plus, Minus, Trash2, Gift, Tag, Clock, Truck, XCircle, FileText, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getB2BCatalogAction, submitB2BOrderAction, getB2BSettingsAction, getB2BPromosAction, getMyB2BOrdersAction } from "@/lib/actions/b2b"; 
import { createBrowserClient } from "@supabase/ssr";

// --- THIS IS THE MISSING BLOCK THAT FIXES THE ERROR ---
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
// ------------------------------------------------------

export default function DistributorKioskPage() {
  const { toast } = useToast();
  
  // VIEW TOGGLE STATE
  const [activeTab, setActiveTab] = useState<"CATALOG" | "MY_ORDERS">("CATALOG");
  
  // Catalog State
  const [catalog, setCatalog] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // My Orders State
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [isFetchingOrders, setIsFetchingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Cart State
  const [cart, setCart] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successPO, setSuccessPO] = useState<string | null>(null);

  // DYNAMIC Business Rules & Promos
  const [wholesaleDiscount, setWholesaleDiscount] = useState(0.30);
  const [minOrderQty, setMinOrderQty] = useState(10);
  const [activePromos, setActivePromos] = useState<any[]>([]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsFetching(true);
      
      const [catalogRes, settingsRes, promosRes] = await Promise.all([
        getB2BCatalogAction(),
        getB2BSettingsAction(),
        getB2BPromosAction()
      ]);
      
      if (settingsRes.data) {
        setWholesaleDiscount(Number(settingsRes.data.b2b_discount_rate));
        setMinOrderQty(Number(settingsRes.data.b2b_moq));
      }

      if (promosRes.data) setActivePromos(promosRes.data);

      if (catalogRes.error) {
        toast({ type: "error", message: `Database Error: ${catalogRes.error}` });
      } else if (catalogRes.data) {
        const normalizedData = catalogRes.data.map(item => ({
          ...item,
          product_name: item.name || "Unknown Product", 
          stock_quantity: item.current_quantity || 0,
          price: item.selling_price || 0
        })).filter(item => item.stock_quantity > 0); 
        
        setCatalog(normalizedData);
      }
      setIsFetching(false);
    };
    fetchInitialData();
  }, []);

  // Fetch orders when tab switches
  useEffect(() => {
    if (activeTab === "MY_ORDERS") {
      const fetchOrders = async () => {
        setIsFetchingOrders(true);
        
        // 1. Safely grab the logged-in user from the browser
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // 2. Pass their ID to the secure backend action
          const res = await getMyB2BOrdersAction(user.id);
          if (res.data) setMyOrders(res.data);
        }
        
        setIsFetchingOrders(false);
      };
      fetchOrders();
    }
  }, [activeTab]);

  const filteredCatalog = catalog.filter(item => 
    item.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = (product: any) => {
    const wholesalePrice = product.price * (1 - wholesaleDiscount);
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          toast({ type: "warning", message: "Maximum available stock reached." });
          return prev;
        }
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: product.id, sku: product.sku, name: product.product_name, wholesalePrice, stock: product.stock_quantity, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        if (newQty > item.stock) {
          toast({ type: "warning", message: "Cannot exceed available stock." });
          return item;
        }
        return { ...item, quantity: Math.max(1, newQty) };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.id !== id));

  const bogoPromos = activePromos.filter(p => {
    const type = String(p.discount_type || '').toUpperCase();
    return type === 'BOGO' || type === 'BUY_X_GET_Y';
  });
  
  const cartPromos = activePromos.filter(p => {
    const type = String(p.discount_type || '').toUpperCase();
    return type === 'PERCENTAGE' || type === 'FIXED_AMOUNT' || type === 'FIXED';
  });

  const calculateFreeItems = (quantity: number, item: any) => {
    let totalFree = 0;
    let remainingQty = quantity;
    const validPromos = bogoPromos.filter(p => p.applicable_scope === 'ENTIRE_ORDER' || p.target_id === item.id || p.target_id === item.sku).sort((a, b) => (Number(b.buy_qty) + Number(b.get_qty)) - (Number(a.buy_qty) + Number(a.get_qty)));

    for (const promo of validPromos) {
      const buyQty = Number(promo.buy_qty);
      const getQty = Number(promo.get_qty);
      const bundleSize = buyQty + getQty; 
      if (bundleSize <= 0) continue;
      const bundles = Math.floor(remainingQty / bundleSize);
      if (bundles > 0) {
        totalFree += bundles * getQty;
        remainingQty -= (bundles * bundleSize); 
      }
    }
    return totalFree;
  };

  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const freeItemsCount = cart.reduce((sum, item) => sum + calculateFreeItems(item.quantity, item), 0);
  const paidItemsCount = totalItemsCount - freeItemsCount;
  
  const cartSubtotal = cart.reduce((sum, item) => {
    const freeAmount = calculateFreeItems(item.quantity, item);
    const paidQuantityForThisItem = item.quantity - freeAmount;
    return sum + (item.wholesalePrice * paidQuantityForThisItem);
  }, 0);

  let grandTotal = cartSubtotal;
  let appliedCartDiscounts: { desc: string, amount: number }[] = [];

  for (const promo of cartPromos) {
    if (promo.applicable_scope === 'ENTIRE_ORDER') {
      const type = String(promo.discount_type || '').toUpperCase();
      if (type === 'PERCENTAGE') {
        const discountAmt = grandTotal * (Number(promo.discount_value) / 100);
        grandTotal -= discountAmt;
        appliedCartDiscounts.push({ desc: promo.description, amount: discountAmt });
      } else {
        grandTotal -= Number(promo.discount_value);
        appliedCartDiscounts.push({ desc: promo.description, amount: Number(promo.discount_value) });
      }
    }
  }
  
  grandTotal = Math.max(0, grandTotal); 
  const isMoqMet = paidItemsCount >= minOrderQty; 

  const handleCheckout = async () => {
    if (!isMoqMet) return toast({ type: "error", message: `Minimum ${minOrderQty} paid items required for wholesale.` });
    
    setIsSubmitting(true);
    let promoNote = freeItemsCount > 0 ? `\n\nSYSTEM NOTE: Includes ${freeItemsCount} free promotional item(s) due to BOGO rules.` : "";
    if (appliedCartDiscounts.length > 0) {
      promoNote += `\nApplied Discounts: ${appliedCartDiscounts.map(d => d.desc).join(', ')}`;
    }

    const res = await submitB2BOrderAction({ cart, totalAmount: grandTotal, notes: notes + promoNote });
    
    if (res.error) {
      toast({ type: "error", message: res.error });
      setIsSubmitting(false);
    } else {
      setSuccessPO(res.poNumber || "UNKNOWN");
      setCart([]);
      setNotes("");
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toUpperCase() || 'PENDING';
    if (s === 'PENDING') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 uppercase tracking-wider"><Clock className="w-3 h-3" /> Pending</span>;
    if (s === 'PROCESSING') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 uppercase tracking-wider"><Package className="w-3 h-3" /> Processing</span>;
    if (s === 'READY') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 uppercase tracking-wider"><Truck className="w-3 h-3" /> Ready for Pickup</span>;
    if (s === 'COMPLETED') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-wider"><CheckCircle2 className="w-3 h-3" /> Completed</span>;
    if (s === 'CANCELLED') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 uppercase tracking-wider"><XCircle className="w-3 h-3" /> Cancelled</span>;
    return <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200 uppercase tracking-wider">{s}</span>;
  };

  if (successPO) {
    return (
      <div className="w-full h-[calc(100vh-8rem)] flex items-center justify-center animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-stone-100 text-center max-w-md w-full">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">Order Submitted!</h2>
          <p className="text-stone-500 mt-2 font-medium">Your Purchase Order has been sent to the warehouse for approval.</p>
          <div className="mt-6 p-4 bg-stone-50 border border-stone-200 rounded-xl">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">PO Number</p>
            <p className="text-xl font-mono font-bold text-blue-600">{successPO}</p>
          </div>
          <button onClick={() => { setSuccessPO(null); setActiveTab("MY_ORDERS"); }} className="mt-8 w-full py-3.5 bg-stone-900 text-white font-bold rounded-xl hover:bg-stone-800 transition-all">
            Track My Order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-300">
      
      {/* HEADER & TOGGLE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 mb-6">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">
            {activeTab === "CATALOG" ? "Wholesale Catalog" : "My Purchase Orders"}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <p className="text-xs text-stone-500">
              {activeTab === "CATALOG" ? "Select items to build your Purchase Order." : "Track the status of your past and present orders."}
            </p>
            
            {activeTab === "CATALOG" && activePromos.map(promo => {
              const type = String(promo.discount_type || '').toUpperCase();
              const isBogo = type === 'BOGO' || type === 'BUY_X_GET_Y';
              return (
                <span key={promo.id} className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${isBogo ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                  {isBogo ? <Gift className="w-3 h-3" /> : <Tag className="w-3 h-3" />}
                  {promo.description}
                </span>
              )
            })}
          </div>
        </div>

        {/* TAB TOGGLE */}
        <div className="flex p-1 bg-stone-100 border border-stone-200 rounded-xl shrink-0">
          <button onClick={() => setActiveTab("CATALOG")} className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'CATALOG' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}>
            New Order
          </button>
          <button onClick={() => setActiveTab("MY_ORDERS")} className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'MY_ORDERS' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-900'}`}>
            My Orders
          </button>
        </div>
      </div>

      {/* VIEWS */}
      {activeTab === "CATALOG" ? (
        
        <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden pb-4">
          {/* LEFT: CATALOG */}
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="relative w-full max-w-md mb-4 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input 
                type="text" 
                placeholder="Search by SKU or name..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm" 
              />
            </div>

            <div className="flex-1 overflow-y-auto pr-2 pb-4">
              {isFetching ? (
                <div className="flex flex-col items-center justify-center h-64 text-stone-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-4" />
                  <p className="text-sm font-medium">Loading inventory...</p>
                </div>
              ) : filteredCatalog.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-stone-400 border-2 border-dashed border-stone-200 rounded-2xl bg-white">
                  <Package className="w-10 h-10 mb-4 text-stone-300" />
                  <p className="text-sm font-bold text-stone-600">No products found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {filteredCatalog.map(item => {
                    const wholesalePrice = item.price * (1 - wholesaleDiscount);
                    
                    return (
                      <div key={item.id} onClick={() => addToCart(item)} className="bg-white p-3 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-50 border border-stone-100 shrink-0 flex items-center justify-center">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover mix-blend-multiply" />
                          ) : (
                            <Package className="w-6 h-6 text-stone-200" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded uppercase tracking-wider">{item.sku}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded">{item.stock_quantity} in stock</span>
                          </div>
                          <h3 className="font-bold text-stone-900 text-sm leading-tight truncate">{item.product_name}</h3>
                          
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm font-black text-blue-600 leading-none">₱{wholesalePrice.toFixed(2)}</p>
                            {wholesalePrice < item.price && (
                              <p className="text-[10px] text-stone-400 line-through">₱{Number(item.price).toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                        
                        <button className="w-10 h-10 shrink-0 rounded-full bg-stone-50 text-stone-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: CART */}
          <div className="w-full lg:w-[400px] flex flex-col bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden shrink-0 h-full">
            <div className="p-5 border-b border-stone-100 bg-stone-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold tracking-tight">Purchase Order</h3>
              </div>
              <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-bold">{totalItemsCount} items</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 bg-stone-50/50">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-stone-400 opacity-60">
                  <ShoppingCart className="w-12 h-12 mb-3" />
                  <p className="text-sm font-medium">Your PO is empty</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map(item => {
                    const freeAmount = calculateFreeItems(item.quantity, item);

                    return (
                      <div key={item.id} className="bg-white p-3 rounded-2xl border border-stone-100 shadow-sm flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 pr-2">
                            <p className="text-[10px] font-bold text-stone-400 mb-0.5">{item.sku}</p>
                            <p className="text-xs font-bold text-stone-900 leading-tight">{item.name}</p>
                            
                            {freeAmount > 0 && (
                              <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded w-fit border border-emerald-100">
                                <Gift className="w-3 h-3" />
                                +{freeAmount} Free
                              </div>
                            )}
                            
                            <p className="text-xs font-black text-blue-600 mt-1">₱{item.wholesalePrice.toFixed(2)}</p>
                          </div>
                          <button onClick={() => removeFromCart(item.id)} className="p-1.5 text-stone-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between bg-stone-50 p-1 rounded-xl border border-stone-200">
                          <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center text-stone-600 hover:bg-white rounded-lg transition-colors shadow-sm"><Minus className="w-3.5 h-3.5" /></button>
                          <span className="font-bold text-sm w-8 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-stone-600 hover:bg-white rounded-lg transition-colors shadow-sm"><Plus className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-stone-100 bg-white shrink-0">
              <div className="mb-4">
                <textarea 
                  placeholder="Add PO notes or shipping instructions..." 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs p-3 bg-stone-50 border border-stone-200 rounded-xl resize-none focus:outline-none focus:border-blue-400"
                  rows={2}
                />
              </div>

              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-bold text-stone-500">Subtotal</span>
                <span className="text-sm font-bold text-stone-900">₱{cartSubtotal.toFixed(2)}</span>
              </div>

              {appliedCartDiscounts.map((discount, idx) => (
                 <div key={idx} className="flex justify-between items-center mb-1 text-rose-600">
                   <span className="text-xs font-bold flex items-center gap-1"><Tag className="w-3 h-3" /> {discount.desc}</span>
                   <span className="text-sm font-bold">-₱{discount.amount.toFixed(2)}</span>
                 </div>
              ))}

              <div className="flex justify-between items-end mb-5 mt-2 pt-2 border-t border-stone-100">
                <span className="text-2xl font-black text-stone-900">Total</span>
                <span className="text-3xl font-black text-blue-600 tracking-tight">₱{grandTotal.toFixed(2)}</span>
              </div>

              {!isMoqMet && cart.length > 0 && (
                 <div className="mb-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-medium">
                   <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                   <p>Wholesale pricing requires a minimum of <span className="font-bold">{minOrderQty} paid items</span>. You need {minOrderQty - paidItemsCount} more.</p>
                 </div>
              )}

              <button 
                disabled={cart.length === 0 || !isMoqMet || isSubmitting}
                onClick={handleCheckout}
                className="w-full py-4 bg-stone-900 text-white font-bold rounded-xl hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Purchase Order"}
              </button>
            </div>
          </div>
        </div>

      ) : (
        
        /* MY ORDERS TRACKING DASHBOARD */
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm flex flex-col flex-1 overflow-hidden">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-[10px] uppercase tracking-[0.1em] text-stone-500 font-bold">
                  <th className="py-4 px-6">PO Number & Date</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Grand Total</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {isFetchingOrders ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-stone-400">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                      Loading your orders...
                    </td>
                  </tr>
                ) : myOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center">
                      <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-stone-100">
                        <Package className="w-8 h-8 text-stone-300" />
                      </div>
                      <h3 className="text-base font-bold text-stone-900 tracking-tight">No orders yet</h3>
                      <p className="text-sm text-stone-500 mt-1">Switch to the Catalog tab to place your first Purchase Order.</p>
                    </td>
                  </tr>
                ) : (
                  myOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-stone-50/80 transition-colors group cursor-pointer" onClick={() => { setSelectedOrder(order); setIsViewModalOpen(true); }}>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-stone-900 font-mono tracking-tight">{order.po_number}</span>
                          <span className="text-[11px] text-stone-500 mt-0.5">{new Date(order.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="text-sm font-black text-stone-900">₱{Number(order.total_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); setIsViewModalOpen(true); }}
                          className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      )}

      {/* --- MODAL: ORDER DETAILS --- */}
      {isViewModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-stone-900/40 backdrop-blur-sm transition-all duration-300 p-4 sm:p-0">
          <div className="absolute inset-0" onClick={() => setIsViewModalOpen(false)} />
          
          <div className="relative bg-white w-full sm:max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300 sm:rounded-l-3xl rounded-2xl overflow-hidden">
            
            <div className="p-6 border-b border-stone-100 bg-stone-50/50 shrink-0">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-black text-stone-900 tracking-tight font-mono">{selectedOrder.po_number}</h3>
                  <p className="text-xs text-stone-500 mt-1">{new Date(selectedOrder.created_at).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                </div>
                <button onClick={() => setIsViewModalOpen(false)} className="p-2 text-stone-400 hover:bg-stone-200 hover:text-stone-700 rounded-xl transition-colors">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Status:</span>
                {getStatusBadge(selectedOrder.status)}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              
              {selectedOrder.notes && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> Order Notes</p>
                  <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">{selectedOrder.notes}</p>
                </div>
              )}

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-stone-400 border-b border-stone-100 pb-2">Line Items Requested</p>
                
                {selectedOrder.b2b_order_items && selectedOrder.b2b_order_items.length > 0 ? (
                  selectedOrder.b2b_order_items.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-stone-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center text-stone-500 font-bold text-sm">
                          {item.quantity}x
                        </div>
                        <div>
                          <p className="text-sm font-bold text-stone-900">{item.product_name || item.name || 'Unknown Product'}</p>
                          <p className="text-[10px] font-mono text-stone-500">{item.sku}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-600">₱{Number(item.wholesale_price * item.quantity).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-stone-500 italic">No items found.</p>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-stone-100 bg-stone-900 text-white shrink-0 flex justify-between items-center">
              <span className="text-sm font-bold text-stone-400">Grand Total</span>
              <span className="text-3xl font-black tracking-tight">₱{Number(selectedOrder.total_amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}