"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, ShoppingCart, Plus, Trash2, CreditCard, Wallet, Banknote, Loader2, Package, Minus, CheckCircle2, Printer, PauseCircle, PlayCircle, ChevronDown, Tag, X, ChevronRight, Menu } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createBrowserClient } from "@supabase/ssr";
import { processCheckoutAction, getNextOrderNumberAction } from "@/lib/actions/pos";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function POSPage() {
  const { toast } = useToast();
  
  const [inventory, setInventory] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [availablePromos, setAvailablePromos] = useState<any[]>([]); 
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [cashierName, setCashierName] = useState("Staff");
  const [currentUserRole, setCurrentUserRole] = useState("Cashier");

  const [orderNo, setOrderNo] = useState("Loading...");
  const [heldOrders, setHeldOrders] = useState<any[]>([]);
  
  const [cart, setCart] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ fullName: "", phone: "", email: "", address: "", status: "Active", notes: "" });
  
  const [promoSearchQuery, setPromoSearchQuery] = useState("");
  const [isPromoDropdownOpen, setIsPromoDropdownOpen] = useState(false);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  
  const [paymentMethod, setPaymentMethod] = useState("CASH"); 
  const [paymentProvider, setPaymentProvider] = useState(""); 
  const [referenceNumber, setReferenceNumber] = useState("");

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [amountTendered, setAmountTendered] = useState("");
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [showRecallModal, setShowRecallModal] = useState(false);

  // NEW: Mobile Cart State
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  const fetchCustomers = async () => {
    const { data } = await supabase.from("customers").select("*").order("full_name");
    setCustomers(data || []);
    return data || [];
  };

  useEffect(() => {
    const loadData = async () => {
      setIsFetching(true);
      const [invRes, custRes, authRes, nextOrderNo, promosRes] = await Promise.all([
        supabase.from("inventory_items").select("*").order("name"),
        fetchCustomers(),
        supabase.auth.getUser(),
        getNextOrderNumberAction(),
        supabase.from("promos").select("*").eq('is_active', true).order('code') 
      ]);
      
      setOrderNo(nextOrderNo);
      setInventory(invRes.data || []);
      setAvailablePromos(promosRes.data || []);
      
      const walkIn = custRes.find(c => c.is_walk_in);
      if (walkIn) {
        setSelectedCustomerId(walkIn.id);
        setCustomerSearchQuery(walkIn.full_name + " (Default)");
      }

      if (authRes.data?.user) {
        const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', authRes.data.user.id).single();
        if (profile?.full_name) setCashierName(profile.full_name);
        if (profile?.role) setCurrentUserRole(profile.role);
      }
      setIsFetching(false);
    };
    loadData();
  }, []);

  const subtotal = cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
  
  const discountAmount = useMemo(() => {
    if (!appliedPromo || cart.length === 0) return 0;
    let discount = 0;

    const type = (appliedPromo.discount_type || '').toUpperCase().replace(' ', '_');
    const scope = (appliedPromo.applicable_scope || '').toUpperCase();

    if (type === 'BUY_X_GET_Y') {
      const targetItem = cart.find(i => i.id === appliedPromo.target_id || i.sku === appliedPromo.target_id);
      if (targetItem) {
        const bundleSize = appliedPromo.buy_qty + appliedPromo.get_qty;
        const numberOfBundles = Math.floor(targetItem.quantity / bundleSize);
        discount = numberOfBundles * appliedPromo.get_qty * targetItem.selling_price;
      }
    } else {
      let applicableSubtotal = subtotal;
      
      if (scope === 'SPECIFIC_SKU') {
        const targetItems = cart.filter(i => i.id === appliedPromo.target_id || i.sku === appliedPromo.target_id);
        applicableSubtotal = targetItems.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
      }

      if (type.includes('PERCENT')) {
        discount = applicableSubtotal * (Number(appliedPromo.discount_value) / 100);
      } else if (type.includes('FIXED') || type.includes('AMOUNT')) {
        discount = Number(appliedPromo.discount_value);
      }
    }
    
    return Math.min(discount, subtotal);
  }, [subtotal, cart, appliedPromo]);

  const grandTotal = Math.max(0, subtotal - discountAmount);
  const vatableSales = grandTotal / 1.12;
  const vatAmount = grandTotal - vatableSales;
  const changeDue = Math.max(0, Number(amountTendered) - grandTotal);

  const filteredPromos = availablePromos.filter(p => 
    p.code.toLowerCase().includes(promoSearchQuery.toLowerCase()) || 
    p.description?.toLowerCase().includes(promoSearchQuery.toLowerCase())
  );

  const handleApplyPromo = async (codeToApply: string) => {
    setIsApplyingPromo(true);
    try {
      const promo = availablePromos.find(p => p.code === codeToApply.toUpperCase());
      if (!promo) {
        setIsApplyingPromo(false);
        return toast({ type: "error", message: "Invalid promo code." });
      }
      if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
        setIsApplyingPromo(false);
        return toast({ type: "error", message: "This promo code has expired." });
      }
      if (!promo.allowed_roles.includes(currentUserRole) && !promo.allowed_roles.includes('Cashier')) {
        setIsApplyingPromo(false);
        return toast({ type: "error", message: "Not authorized to use this promo." });
      }
      if (promo.min_spend > 0 && subtotal < promo.min_spend) {
        setIsApplyingPromo(false);
        return toast({ type: "error", message: `Minimum spend of ₱${promo.min_spend} required.` });
      }
      if (promo.applicable_scope === 'SPECIFIC_SKU') {
        const hasItem = cart.some(i => i.id === promo.target_id || i.sku === promo.target_id);
        if (!hasItem) {
          setIsApplyingPromo(false);
          return toast({ type: "error", message: "Required item not found in cart." });
        }
      }
      if (promo.discount_type === 'BUY_X_GET_Y') {
        const targetItem = cart.find(i => i.id === promo.target_id || i.sku === promo.target_id);
        const requiredQty = promo.buy_qty + promo.get_qty;
        if (!targetItem || targetItem.quantity < requiredQty) {
          setIsApplyingPromo(false);
          return toast({ type: "error", message: `You need at least ${requiredQty} items for this deal.` });
        }
      }
      setAppliedPromo(promo);
      setPromoSearchQuery("");
      toast({ type: "success", message: `Promo '${promo.code}' applied!` });
    } catch (err: any) {
      toast({ type: "error", message: "Failed to verify promo." });
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    toast({ type: "success", message: "Promo removed." });
  };

  const filteredCustomerSearch = customers.filter(c => 
    c.full_name.toLowerCase().includes(customerSearchQuery.toLowerCase()) || 
    (c.phone && c.phone.includes(customerSearchQuery))
  );

  const selectCustomer = (c: any) => {
    setSelectedCustomerId(c.id);
    setCustomerSearchQuery(c.full_name + (c.is_walk_in ? " (Default)" : ""));
    setIsCustomerDropdownOpen(false);
    
    if (c.status === 'VIP' && !appliedPromo) {
       const vipPromo = availablePromos.find(p => p.code === 'VIP10');
       if (vipPromo) {
         toast({ type: "success", message: "VIP Customer Selected. Apply 'VIP10' promo for discount." });
       }
    }
  };

  const addToCart = (item: any) => {
    const isService = item.category.includes("Service") || item.category.includes("Treatment") || item.category === "Packages";
    if (!isService) {
      const inCart = cart.find(i => i.id === item.id)?.quantity || 0;
      if (inCart >= item.current_quantity) {
        return toast({ type: "error", message: `Cannot add more! Only ${item.current_quantity} left.` });
      }
    }
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const decreaseQuantity = (id: string) => setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item));
  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id));

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.fullName) return toast({ type: "error", message: "Customer name is required." });
    
    setIsCreatingCustomer(true);
    try {
      const { data, error } = await supabase.from('customers').insert([{ 
        full_name: newCustomerForm.fullName, phone: newCustomerForm.phone || null, email: newCustomerForm.email || null,
        address: newCustomerForm.address || null, status: newCustomerForm.status, notes: newCustomerForm.notes || null, is_walk_in: false
      }]).select().single();

      if (error) throw error;
      toast({ type: "success", message: "Client added successfully!" });
      const updatedCustomers = await fetchCustomers();
      if (data) {
        setSelectedCustomerId(data.id);
        setCustomerSearchQuery(data.full_name);
      }
      setNewCustomerForm({ fullName: "", phone: "", email: "", address: "", status: "Active", notes: "" });
      setIsAddCustomerOpen(false);
    } catch (err: any) {
      toast({ type: "error", message: err.message || "Failed to add customer." });
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const handleHoldOrder = async () => {
    if (cart.length === 0) return toast({ type: "error", message: "Cannot hold an empty cart." });
    const holdPayload = { orderNo, cart, selectedCustomerId, customerSearchQuery, appliedPromo };
    setHeldOrders(prev => [...prev, holdPayload]);
    toast({ type: "success", message: `Order ${orderNo} placed on hold.` });
    await resetPOS(false); 
    setIsMobileCartOpen(false); // Close mobile cart on hold
  };

  const handleRecallOrder = (index: number) => {
    const orderToRecall = heldOrders[index];
    setOrderNo(orderToRecall.orderNo);
    setCart(orderToRecall.cart);
    setSelectedCustomerId(orderToRecall.selectedCustomerId);
    setCustomerSearchQuery(orderToRecall.customerSearchQuery);
    setAppliedPromo(orderToRecall.appliedPromo);
    
    setHeldOrders(prev => prev.filter((_, i) => i !== index));
    setShowRecallModal(false);
    toast({ type: "success", message: `Order ${orderToRecall.orderNo} recalled.` });
  };

  const handleProcessPaymentClick = () => {
    if (cart.length === 0) return toast({ type: "error", message: "Cart is empty" });
    if (!selectedCustomerId) return toast({ type: "error", message: "Please select a customer" });
    if (paymentMethod !== "CASH") {
      if (!paymentProvider) return toast({ type: "error", message: "Please select a provider" });
      if (!referenceNumber) return toast({ type: "error", message: "Reference number is required" });
    }
    if (paymentMethod === "CASH") setAmountTendered(grandTotal.toFixed(2));
    setIsPaymentModalOpen(true);
  };

  const executeFinalCheckout = async () => {
    if (paymentMethod === "CASH" && Number(amountTendered) < grandTotal) return toast({ type: "error", message: "Amount tendered is less than Grand Total!" });
    
    setIsLoading(true);
    const payload = {
      cart, customerId: selectedCustomerId, cashierName, subtotal, 
      discountType: appliedPromo ? appliedPromo.code : "NONE", 
      discountValue: appliedPromo ? appliedPromo.discount_value : "", 
      discountAmount, discountID: "", grandTotal, paymentMethod, paymentProvider, referenceNumber
    };

    const res = await processCheckoutAction(payload);

    if (res?.error) {
      toast({ type: "error", message: res.error });
      setIsLoading(false);
      return;
    }

    const customer = customers.find(c => c.id === selectedCustomerId);
    setInvoiceData({
      receiptNumber: res.data?.receiptNumber || orderNo, 
      date: new Date(res.data?.date || new Date()), 
      customerName: customer ? customer.full_name : "Walk-in Customer",
      cashierName, cart: [...cart], subtotal, discountAmount, discountType: appliedPromo ? appliedPromo.code : "NONE", grandTotal,
      vatableSales, vatAmount, paymentMethod, paymentProvider, referenceNumber,
      amountTendered: paymentMethod === "CASH" ? Number(amountTendered) : grandTotal,
      changeDue: paymentMethod === "CASH" ? changeDue : 0
    });

    const { data: refreshedInv } = await supabase.from("inventory_items").select("*").order("name");
    if (refreshedInv) setInventory(refreshedInv);

    setIsPaymentModalOpen(false);
    setIsMobileCartOpen(false); // Close mobile cart on success
    setShowInvoice(true);
    setIsLoading(false);
    toast({ type: "success", message: "Payment Processed!" });
  };

  const resetPOS = async (fullReset = false) => {
    setShowInvoice(false);
    setInvoiceData(null);
    setCart([]);
    setAppliedPromo(null);
    setPaymentMethod("CASH");
    setPaymentProvider("");
    setReferenceNumber("");
    setAmountTendered("");
    setIsMobileCartOpen(false); // Ensure cart is closed on reset
    
    const nextNo = await getNextOrderNumberAction();
    setOrderNo(nextNo); 
    
    const walkIn = customers.find(c => c.is_walk_in);
    if (walkIn) {
      setSelectedCustomerId(walkIn.id);
      setCustomerSearchQuery(walkIn.full_name + " (Default)");
    }
  };

  const handlePrint = () => window.print();

  const filteredItems = inventory.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.sku.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <>
      <div className="flex flex-1 h-full lg:h-[calc(100vh-8rem)] relative overflow-hidden animate-in fade-in duration-500 print:hidden">
        
        {/* LEFT: Catalog */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 pb-20 lg:pb-0 h-full overflow-hidden">
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search products or services..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500/20 outline-none text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>

          <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 content-start">
            {filteredItems.map(item => {
              const isService = item.category.includes("Service") || item.category.includes("Treatment") || item.category === "Packages";
              const isOutOfStock = !isService && item.current_quantity <= 0;

              return (
                <button key={item.id} onClick={() => addToCart(item)} disabled={isOutOfStock} className={`bg-white p-2 sm:p-2.5 rounded-xl border shadow-sm transition-all text-left flex flex-col group h-full ${isOutOfStock ? 'border-slate-100 opacity-50 cursor-not-allowed' : 'border-slate-200 hover:border-blue-500 hover:shadow-md'}`}>
                  <div className="w-full h-28 sm:h-36 rounded-lg bg-slate-50 overflow-hidden border border-slate-100 shrink-0">
                    {item.image_url ? <img src={item.image_url} className={`w-full h-full object-cover transition-transform duration-300 ${!isOutOfStock && 'group-hover:scale-105'}`} /> : <Package className="w-full h-full p-6 text-slate-200" />}
                  </div>
                  <div className="flex flex-col flex-1 mt-2">
                    <p className="font-bold text-slate-900 text-[11px] sm:text-xs line-clamp-2 leading-tight">{item.name}</p>
                    <p className="text-[11px] sm:text-xs text-blue-600 font-bold mt-1">₱{item.selling_price}</p>
                    <div className="mt-auto pt-2 sm:pt-3">
                      {isService ? (
                        <div className="text-[8px] sm:text-[9px] font-bold uppercase px-2 py-0.5 rounded w-max bg-indigo-50 text-indigo-600 border border-indigo-100/50">Service</div>
                      ) : (
                        <div className={`text-[8px] sm:text-[9px] font-bold uppercase px-2 py-0.5 rounded w-max border ${item.current_quantity > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100/50' : 'bg-rose-50 text-rose-600 border-rose-100/50'}`}>
                          {item.current_quantity} in stock
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* MOBILE OVERLAY FOR CART */}
        {isMobileCartOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileCartOpen(false)}
          />
        )}

        {/* RIGHT: Cart & Payment */}
        <div className={`
          fixed inset-y-0 right-0 z-50 w-[85%] sm:w-[400px] bg-white border-l border-slate-200 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0 lg:w-[400px] lg:shadow-xl lg:rounded-2xl lg:ml-6 lg:border
          ${isMobileCartOpen ? "translate-x-0" : "translate-x-full"}
        `}>
          <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/50 shrink-0 flex flex-col gap-3">
            
            <div className="flex justify-between items-center">
              <span className="text-[10px] sm:text-xs font-black text-blue-600 tracking-widest uppercase bg-blue-100/50 px-2 py-1 rounded-md">Order #{orderNo}</span>
              
              <div className="flex items-center gap-1.5">
                <button onClick={handleHoldOrder} className="text-[10px] sm:text-[11px] font-bold text-slate-500 hover:text-amber-600 flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm transition-colors"><PauseCircle className="w-3 h-3" /> Hold</button>
                {heldOrders.length > 0 && (
                  <button onClick={() => setShowRecallModal(true)} className="text-[10px] sm:text-[11px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-200 px-2 py-1 rounded shadow-sm transition-colors flex items-center gap-1"><PlayCircle className="w-3 h-3" /> Recall ({heldOrders.length})</button>
                )}
                <button onClick={() => setIsMobileCartOpen(false)} className="lg:hidden p-1 -mr-1 text-slate-400 hover:bg-slate-200 rounded-md ml-2"><X className="w-5 h-5"/></button>
              </div>
            </div>

            <div className="relative">
              <div className="flex gap-2 relative z-20">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    placeholder="Search customer..." 
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 h-[38px] text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={customerSearchQuery}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setSelectedCustomerId(""); 
                      setIsCustomerDropdownOpen(true);
                    }}
                    onFocus={() => {
                      setCustomerSearchQuery("");
                      setIsCustomerDropdownOpen(true);
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setIsCustomerDropdownOpen(false);
                        const current = customers.find(c => c.id === selectedCustomerId);
                        if (current) {
                          setCustomerSearchQuery(current.full_name + (current.is_walk_in ? " (Default)" : ""));
                        } else {
                          const walkIn = customers.find(c => c.is_walk_in);
                          if (walkIn) {
                            setSelectedCustomerId(walkIn.id);
                            setCustomerSearchQuery(walkIn.full_name + " (Default)");
                          }
                        }
                      }, 200);
                    }}
                  />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  
                  {isCustomerDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsCustomerDropdownOpen(false)} />
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-20 overflow-hidden py-1">
                        {filteredCustomerSearch.length === 0 ? (
                          <div className="p-3 text-xs text-slate-500 text-center">No clients found</div>
                        ) : (
                          filteredCustomerSearch.map(c => (
                            <button key={c.id} onMouseDown={(e) => { e.preventDefault(); selectCustomer(c); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex flex-col border-b border-slate-50 last:border-0">
                              <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                {c.full_name} 
                                {c.is_walk_in && <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">DEFAULT</span>}
                                {c.status === 'VIP' && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase">VIP</span>}
                              </span>
                              {c.phone && <span className="text-[11px] text-slate-500">{c.phone}</span>}
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
                <button onClick={() => setIsAddCustomerOpen(true)} className="w-[38px] h-[38px] flex items-center justify-center bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-blue-600 transition-colors shrink-0"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/30">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                <ShoppingCart className="w-10 h-10 mb-2 text-slate-300" />
                <p className="text-xs font-medium">Cart is empty</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="flex items-start gap-2 bg-white border border-slate-200 p-2 sm:p-2.5 rounded-lg shadow-sm group">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] sm:text-xs font-bold text-slate-900 truncate">{item.name}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md shrink-0 h-6 sm:h-7">
                        <button onClick={() => decreaseQuantity(item.id)} className="px-2 h-full hover:bg-slate-200 text-slate-600 font-bold transition-colors rounded-l-md"><Minus className="w-3 h-3" /></button>
                        <span className="px-2 text-[11px] font-bold text-slate-900 min-w-[1.5rem] text-center">{item.quantity}</span>
                        <button onClick={() => addToCart(item)} className="px-2 h-full hover:bg-slate-200 text-slate-600 font-bold transition-colors rounded-r-md"><Plus className="w-3 h-3" /></button>
                      </div>
                      <span className="text-[9px] sm:text-[10px] font-medium text-slate-400">@ ₱{item.selling_price}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between h-full py-0.5 gap-2 shrink-0">
                    <p className="text-[11px] sm:text-xs font-black text-slate-900">₱{(item.quantity * item.selling_price).toFixed(2)}</p>
                    <button onClick={() => removeFromCart(item.id)} className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 sm:p-4 bg-slate-900 text-white shrink-0 flex flex-col gap-3 pb-8 lg:pb-4">
            <div className="flex flex-col gap-1.5 border-b border-white/10 pb-3">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Subtotal</span>
                <span className="font-medium text-white">₱{subtotal.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between items-center gap-2 relative">
                <span className="text-xs text-slate-400">Promo</span>
                
                {appliedPromo ? (
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md text-emerald-400">
                    <Tag className="w-3 h-3" />
                    <span className="text-[10px] font-black uppercase tracking-wider">{appliedPromo.code}</span>
                    <button onClick={removePromo} className="ml-1 text-emerald-400 hover:text-white transition-colors"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <div className="relative flex-1 max-w-[150px]">
                    <input 
                      type="text" 
                      placeholder="Select Promo..." 
                      className="w-full bg-white/10 border border-white/20 rounded px-2 h-7 text-[10px] uppercase font-bold text-white outline-none focus:border-blue-500 placeholder:text-slate-400 placeholder:font-normal placeholder:normal-case" 
                      value={promoSearchQuery} 
                      onChange={(e) => {
                        setPromoSearchQuery(e.target.value.toUpperCase());
                        setIsPromoDropdownOpen(true);
                      }} 
                      onFocus={() => {
                        setPromoSearchQuery("");
                        setIsPromoDropdownOpen(true);
                      }}
                      onBlur={() => setTimeout(() => setIsPromoDropdownOpen(false), 200)}
                    />
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />

                    {isPromoDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsPromoDropdownOpen(false)} />
                        <div className="absolute bottom-full right-0 mb-1 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto z-20 py-1">
                          {filteredPromos.length === 0 ? (
                            <div className="p-3 text-[10px] text-slate-500 text-center font-normal">No active promos</div>
                          ) : (
                            filteredPromos.map(p => (
                              <button 
                                key={p.id}
                                onClick={() => {
                                  setIsPromoDropdownOpen(false);
                                  handleApplyPromo(p.code); 
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex flex-col border-b border-slate-50 last:border-0"
                              >
                                <span className="text-xs font-bold text-slate-900">{p.code}</span>
                                <span className="text-[9px] text-slate-500 line-clamp-1">{p.description}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {(discountAmount > 0) && (
                <div className="flex justify-between text-rose-400 text-xs font-bold pt-1 animate-in slide-in-from-top-1">
                  <span>Discount</span><span>-₱{discountAmount.toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between items-end pt-1 mt-1 border-t border-white/5">
                <span className="text-slate-300 text-xs font-medium">Grand Total</span>
                <span className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none">₱{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3">
               <div className="flex p-1 bg-white/5 rounded-lg border border-white/10">
                  <button onClick={() => {setPaymentMethod("CASH"); setPaymentProvider(""); setReferenceNumber("");}} className={`flex-1 py-1.5 text-[9px] sm:text-[10px] font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${paymentMethod === 'CASH' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><Banknote className="w-3.5 h-3.5" /> CASH</button>
                  <button onClick={() => {setPaymentMethod("E-WALLET"); setPaymentProvider(""); setReferenceNumber("");}} className={`flex-1 py-1.5 text-[9px] sm:text-[10px] font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${paymentMethod === 'E-WALLET' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><Wallet className="w-3.5 h-3.5" /> WALLET</button>
                  <button onClick={() => {setPaymentMethod("CARD"); setPaymentProvider(""); setReferenceNumber("");}} className={`flex-1 py-1.5 text-[9px] sm:text-[10px] font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${paymentMethod === 'CARD' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}><CreditCard className="w-3.5 h-3.5" /> CARD</button>
               </div>

               <div className="h-[36px] flex gap-2">
                 {paymentMethod === "E-WALLET" && (
                    <>
                      <select value={paymentProvider} onChange={(e) => setPaymentProvider(e.target.value)} className="w-1/2 bg-white/10 border border-white/20 rounded-lg px-2 h-full text-xs text-white outline-none focus:border-blue-500 [&>option]:text-slate-900 animate-in fade-in">
                        <option value="" disabled>Provider...</option><option value="GCash">GCash</option><option value="PayMaya">PayMaya</option><option value="GrabPay">GrabPay</option><option value="ShopeePay">ShopeePay</option>
                      </select>
                      <input autoComplete="off" type="text" placeholder="Ref / Code" className="w-1/2 bg-white/10 border border-white/20 rounded-lg px-2 h-full text-xs text-white outline-none focus:border-blue-500 placeholder:text-slate-500 animate-in fade-in" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
                    </>
                 )}
                 {paymentMethod === "CARD" && (
                    <>
                      <select value={paymentProvider} onChange={(e) => setPaymentProvider(e.target.value)} className="w-1/2 bg-white/10 border border-white/20 rounded-lg px-2 h-full text-xs text-white outline-none focus:border-blue-500 [&>option]:text-slate-900 animate-in fade-in">
                        <option value="" disabled>Card Type...</option><option value="Visa">Visa</option><option value="Mastercard">Mastercard</option><option value="JCB">JCB</option>
                      </select>
                      <input autoComplete="off" type="text" placeholder="Ref / Code" className="w-1/2 bg-white/10 border border-white/20 rounded-lg px-2 h-full text-xs text-white outline-none focus:border-blue-500 placeholder:text-slate-500 animate-in fade-in" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
                    </>
                 )}
                 {paymentMethod === "CASH" && (
                   <div className="w-full h-full flex items-center justify-center border border-white/10 border-dashed rounded-lg bg-white/5 animate-in fade-in"><span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">No Reference Needed</span></div>
                 )}
               </div>

              <button onClick={handleProcessPaymentClick} disabled={isLoading || cart.length === 0} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/5 disabled:text-slate-500 disabled:border-transparent text-white font-black text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "PROCEED TO PAYMENT"}
              </button>
            </div>
          </div>
        </div>

        {/* FLOATING MOBILE CART BUTTON (Only visible on small screens when cart is closed) */}
        {!isMobileCartOpen && (
          <div className="lg:hidden fixed bottom-4 left-4 right-4 z-30">
            <button 
              onClick={() => setIsMobileCartOpen(true)}
              className="w-full bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-2xl border border-slate-700 active:scale-95 transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingCart className="w-6 h-6 text-slate-300" />
                  {cart.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900">
                      {cart.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">View Cart</p>
                  <p className="text-sm font-black mt-0.5 leading-none">₱{grandTotal.toFixed(2)}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        )}

      </div>

      {/* --- ENTERPRISE PAYMENT CONFIRMATION MODAL --- */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 mx-4">
            <div className="p-6 bg-slate-900 text-white text-center">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Confirm Payment</h3>
              <p className="text-3xl font-black">₱{grandTotal.toFixed(2)}</p>
              <p className="text-xs text-blue-400 mt-2 font-medium">Paying via {paymentMethod} {paymentProvider ? `(${paymentProvider})` : ''}</p>
            </div>
            <div className="p-4 sm:p-6 space-y-5">
              {paymentMethod === "CASH" && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 block">Amount Tendered</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₱</span>
                      <input type="number" min={grandTotal} className="w-full pl-8 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 text-xl font-black text-slate-900 outline-none" value={amountTendered} onChange={(e) => setAmountTendered(e.target.value)} autoFocus />
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-100 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-600">Change Due:</span>
                    <span className={`text-xl sm:text-2xl font-black ${changeDue < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>₱{changeDue < 0 ? '0.00' : changeDue.toFixed(2)}</span>
                  </div>
                </>
              )}
              {paymentMethod !== "CASH" && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-center text-center">
                  <p className="text-sm font-bold text-blue-800">Ensure the {paymentProvider || 'Card'} terminal is approved for <span className="font-black">₱{grandTotal.toFixed(2)}</span> before confirming.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button onClick={() => setIsPaymentModalOpen(false)} disabled={isLoading} className="py-3 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                <button onClick={executeFinalCheckout} disabled={isLoading || (paymentMethod === "CASH" && Number(amountTendered) < grandTotal)} className="py-3 flex justify-center items-center gap-2 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Confirm</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- RECALL ORDER MODAL --- */}
      {showRecallModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 mx-4">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2"><PlayCircle className="w-5 h-5 text-blue-600" /> Recall Held Orders</h3>
              <button onClick={() => setShowRecallModal(false)} className="p-1 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors">Close</button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3 bg-slate-50/50">
              {heldOrders.map((order, idx) => {
                const orderTotal = order.cart.reduce((sum: number, i: any) => sum + (i.selling_price * i.quantity), 0);
                return (
                  <div key={idx} className="bg-white border border-slate-200 p-3 sm:p-4 rounded-xl shadow-sm flex items-center justify-between group">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">{order.customerSearchQuery}</p>
                      <p className="text-[10px] sm:text-xs font-medium text-slate-500 mt-0.5">Order {order.orderNo} • {order.cart.length} items</p>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                      <span className="font-black text-slate-900 text-sm sm:text-base">₱{orderTotal.toFixed(2)}</span>
                      <button onClick={() => handleRecallOrder(idx)} className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-50 text-blue-700 font-bold text-xs rounded-lg hover:bg-blue-600 hover:text-white transition-colors">Resume</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- QUICK ADD CUSTOMER MODAL --- */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 mx-4">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Add New Client</h3>
              </div>
              <button type="button" onClick={() => setIsAddCustomerOpen(false)} className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleQuickAddCustomer} className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs sm:text-sm font-medium text-slate-700">Full Name <span className="text-rose-500">*</span></label>
                  <input autoComplete="off" type="text" required disabled={isCreatingCustomer} value={newCustomerForm.fullName} onChange={e => setNewCustomerForm({...newCustomerForm, fullName: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm" placeholder="e.g. Maria Clara" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-medium text-slate-700">Status</label>
                  <select disabled={isCreatingCustomer} value={newCustomerForm.status} onChange={e => setNewCustomerForm({...newCustomerForm, status: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm appearance-none"><option value="Active">Active</option><option value="VIP">VIP</option></select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-medium text-slate-700">Phone Number</label>
                  <input autoComplete="off" type="tel" disabled={isCreatingCustomer} value={newCustomerForm.phone} onChange={e => setNewCustomerForm({...newCustomerForm, phone: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm" placeholder="0917..." />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-medium text-slate-700">Email Address</label>
                  <input autoComplete="off" type="email" disabled={isCreatingCustomer} value={newCustomerForm.email} onChange={e => setNewCustomerForm({...newCustomerForm, email: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm" placeholder="maria@example.com" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-medium text-slate-700">Address</label>
                <input autoComplete="off" type="text" disabled={isCreatingCustomer} value={newCustomerForm.address} onChange={e => setNewCustomerForm({...newCustomerForm, address: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm" placeholder="123 Main St, Quezon City" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-medium text-slate-700">Preferences / Notes</label>
                <textarea disabled={isCreatingCustomer} value={newCustomerForm.notes} onChange={e => setNewCustomerForm({...newCustomerForm, notes: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-sm resize-none" placeholder="Allergies, preferred therapist, etc." rows={3}></textarea>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsAddCustomerOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={isCreatingCustomer} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                  {isCreatingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ENTERPRISE INVOICE / RECEIPT MODAL --- */}
      {showInvoice && invoiceData && (
        <div id="print-modal-overlay" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200 print:p-0 print:bg-white print:block">
          
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              @page { size: letter portrait; margin: 0.5in; }
              html, body { height: auto !important; min-height: auto !important; overflow: visible !important; background: white !important; }
              body * { visibility: hidden; }
              #printable-invoice-wrapper, #printable-invoice-wrapper * { visibility: visible; }
              #printable-invoice-wrapper {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                max-width: 100% !important;
                margin: 0;
                padding: 0;
                box-shadow: none !important;
              }
              .print\\:hidden { display: none !important; }
            }
          `}} />

          {/* Modal Container for Screen */}
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl my-auto print:my-0 print:rounded-none print:shadow-none flex flex-col max-h-[90vh] print:max-h-none mx-2 sm:mx-4">
            
            {/* The actual printable area */}
            <div id="printable-invoice-wrapper" className="p-6 sm:p-8 md:p-12 overflow-y-auto print:overflow-visible print:p-0">
              
              {/* Header */}
              <div className="text-center mb-6 sm:mb-8">
                <div className="flex justify-center items-center gap-3 sm:gap-5 mb-4 sm:mb-5 opacity-90">
                  <img src="/PrettySkinLogo.png" alt="Pretty Skin" className="h-8 sm:h-10 object-contain grayscale print:grayscale-0" />
                  <div className="w-px h-6 sm:h-8 bg-slate-300"></div>
                  <img src="/LamelinLogo.png" alt="Lamelin" className="h-8 sm:h-10 object-contain grayscale print:grayscale-0" />
                </div>
                <h1 className="text-lg sm:text-2xl font-black uppercase tracking-widest text-slate-900 mb-1">Prettyskin Lamelin</h1>
                <p className="text-[10px] sm:text-xs text-slate-600 font-medium">841 Turin St. BF International, BF Homes, Las Piñas City</p>
                <p className="text-[10px] sm:text-xs text-slate-600 font-medium">Tel: 8253485 / 7880934</p>
                <p className="text-[10px] sm:text-xs font-bold text-slate-900 mt-1">TIN: 222-513-229-000</p>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] gap-y-1.5 text-xs sm:text-sm mb-6 sm:mb-8">
                <span className="text-slate-500">Date & Time:</span>
                <span className="text-right font-medium text-slate-900">
                  {invoiceData.date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })},{' '}
                  {invoiceData.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>

                <span className="text-slate-500">Trans #:</span>
                <span className="text-right font-medium text-slate-900">{invoiceData.receiptNumber}</span>

                <span className="text-slate-500">Cashier:</span>
                <span className="text-right font-medium text-slate-900 uppercase">{invoiceData.cashierName}</span>

                <span className="font-bold text-slate-900 mt-2">Customer:</span>
                <span className="text-right font-bold text-slate-900 uppercase mt-2">{invoiceData.customerName}</span>
              </div>

              <div className="border-b border-dashed border-slate-300 mb-4"></div>

              {/* Items Table */}
              <table className="w-full text-xs sm:text-sm mb-4">
                <thead>
                  <tr className="text-left font-bold text-slate-900">
                    <th className="pb-2 font-bold uppercase tracking-wider text-[10px] sm:text-xs">Item</th>
                    <th className="pb-2 text-center w-12 sm:w-20 font-bold uppercase tracking-wider text-[10px] sm:text-xs">Qty</th>
                    <th className="pb-2 text-right w-20 sm:w-28 font-bold uppercase tracking-wider text-[10px] sm:text-xs">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceData.cart.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2 text-slate-800 pr-2">{item.name}</td>
                      <td className="py-2 text-center font-medium text-slate-800">{item.quantity}</td>
                      <td className="py-2 text-right font-medium text-slate-800">{(item.quantity * item.selling_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-b border-dashed border-slate-300 mb-4"></div>

              {/* Subtotals */}
              <div className="space-y-1.5 text-xs sm:text-sm mb-4">
                <div className="flex justify-between text-slate-800">
                  <span>Subtotal:</span>
                  <span>{invoiceData.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-800 items-center">
                  <span>Less: Discount {invoiceData.discountAmount > 0 && invoiceData.discountType !== 'NONE' ? <span className="text-[9px] sm:text-[10px] font-bold uppercase text-slate-500 tracking-wider">({invoiceData.discountType})</span> : ''}</span>
                  <span>{invoiceData.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-black text-slate-900 text-base sm:text-lg pt-2 pb-2">
                  <span>TOTAL AMOUNT:</span>
                  <span>{invoiceData.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="border-b border-dashed border-slate-300 mb-4"></div>

              {/* VAT Details */}
              <div className="space-y-1 text-[10px] sm:text-xs text-slate-600 mb-6">
                <div className="flex justify-between">
                  <span>Vatable Sales:</span>
                  <span>{invoiceData.vatableSales.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT Amount (12%):</span>
                  <span>{invoiceData.vatAmount.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT Exempt:</span>
                  <span>0.000</span>
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-1.5 text-xs sm:text-sm font-medium text-slate-800 mb-6">
                <div className="flex justify-between font-bold">
                  <span>Amount Tendered:</span>
                  <span>{invoiceData.amountTendered.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span className="uppercase">
                    {invoiceData.paymentMethod}
                    {invoiceData.paymentProvider ? ` (${invoiceData.paymentProvider})` : ''}
                  </span>
                </div>
                {/* Reference Number Included Here */}
                {invoiceData.referenceNumber && (
                  <div className="flex justify-between">
                    <span>Ref No:</span>
                    <span className="uppercase text-right font-mono">{invoiceData.referenceNumber}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm sm:text-base pt-2">
                  <span>CHANGE:</span>
                  <span>{invoiceData.changeDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="border-b border-dashed border-slate-300 mb-6 sm:mb-8"></div>

              {/* Footer */}
              <div className="text-center space-y-2">
                <h3 className="font-black text-slate-900 tracking-widest uppercase text-sm sm:text-base">Thank You For Buying!</h3>
                <p className="text-xs sm:text-sm text-slate-600">Please come again.</p>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-4">Powered by Prettyskin POS</p>
              </div>

            </div>

            {/* Screen Action Buttons */}
            <div className="bg-slate-50 p-4 sm:p-5 border-t border-slate-200 flex flex-col sm:flex-row gap-3 sm:gap-4 print:hidden shrink-0">
              <button onClick={handlePrint} className="flex-1 py-3 sm:py-4 flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-sm"><Printer className="w-4 sm:w-5 h-4 sm:h-5" /> Print Receipt</button>
              <button onClick={() => resetPOS(true)} className="flex-1 py-3 sm:py-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-sm"><CheckCircle2 className="w-4 sm:w-5 h-4 sm:h-5" /> Complete Order</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}