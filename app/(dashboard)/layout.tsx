"use client";

import { LayoutDashboard, ShoppingCart, Users, Settings, LogOut, ChevronDown, AlertTriangle, Package, ReceiptText, FileText, ArrowDownRight, ShoppingBag, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useToast } from "@/hooks/use-toast";

type MenuSubItem = { title: string; href: string; roles?: string[] };
type MenuItem = { title: string; href?: string; icon: React.ElementType; subItems?: MenuSubItem[]; roles?: string[] };
type MenuGroup = { group: string; items: MenuItem[]; };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const [time, setTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  
  const [userName, setUserName] = useState("Team");
  const [userRole, setUserRole] = useState("Staff"); 
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // NEW MOBILE STATE
  
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    "System Settings": true 
  });

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setTime(new Date()), 1000);

    const fetchUser = async () => {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, role')
            .eq('id', user.id)
            .single();
          
          if (profile) {
            if (profile.full_name) setUserName(profile.full_name);
            if (profile.role) setUserRole(profile.role);
          } else if (user.email) {
            const namePart = user.email.split('@')[0];
            setUserName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
          }
        }
      } catch (err) {}
    };
    
    fetchUser();
    return () => clearInterval(timer);
  }, []);

  const toggleSidebarMenu = (menuTitle: string) => {
    setOpenMenus(prev => ({ ...prev, [menuTitle]: !prev[menuTitle] }));
  };

  const confirmSignOut = async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      await supabase.auth.signOut();
      toast({ type: "success", message: "Successfully signed out." });
      router.push("/login");
    } catch (error) {
      toast({ type: "error", message: "Failed to sign out." });
    } finally {
      setIsSignOutModalOpen(false);
    }
  };

  const menuGroups: MenuGroup[] = [
  {
      group: "CORE SYSTEMS",
      items: [
        { title: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["Super Admin", "Manager"] },
        { title: "Point of Sale", href: "/pos", icon: ShoppingCart, roles: ["Super Admin", "Manager", "Staff", "Cashier"] },
        { title: "B2B Kiosk", href: "/distributor/kiosk", icon: ShoppingBag, roles: ["Super Admin", "Distributor"] },
        
        { title: "Retail Sales", href: "/sales", icon: ReceiptText, roles: ["Super Admin", "Manager", "Staff", "Cashier"] },
        { title: "B2B Fulfillment", href: "/sales-history", icon: FileText, roles: ["Super Admin", "Manager"] },
        
        { title: "Expenses", href: "/expenses", icon: ArrowDownRight, roles: ["Super Admin", "Manager"] },
        { title: "Inventory", href: "/inventory", icon: Package, roles: ["Super Admin", "Manager"] },
        { title: "Customers", href: "/customers", icon: Users, roles: ["Super Admin", "Manager", "Staff", "Cashier"] }, 
      ]
    },  
    {
      group: "ADMINISTRATION",
      items: [
        { 
          title: "System Settings", 
          icon: Settings,
          roles: ["Super Admin", "Manager"],
          subItems: [
            { title: "User Management", href: "/settings/user-management", roles: ["Super Admin"] },
            { title: "B2B Settings", href: "/settings/b2b", roles: ["Super Admin", "Manager"] },
            { title: "Promos & Deals", href: "/promos", roles: ["Super Admin", "Manager"] } 
          ]
        }
      ]
    }
  ];

  const filteredMenuGroups = menuGroups.map(group => {
    const filteredItems = group.items
      .filter(item => {
        if (item.roles && userRole && !item.roles.includes(userRole)) return false;
        return true;
      })
      .map(item => {
        if (item.subItems) {
          return {
            ...item,
            subItems: item.subItems.filter(sub => !sub.roles || (userRole && sub.roles.includes(userRole)))
          };
        }
        return item;
      })
      .filter(item => {
        if (item.subItems && item.subItems.length === 0) return false;
        return true;
      });

    return { ...group, items: filteredItems };
  }).filter(group => group.items.length > 0);

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex font-sans antialiased bg-stone-50 text-neutral-900 w-full relative overflow-hidden">
      
      {/* MOBILE OVERLAY */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-stone-900/40 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col border-r border-stone-200 
        shadow-2xl md:shadow-sm overflow-y-auto shrink-0 transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="p-6 border-b border-stone-100 shrink-0 flex items-center justify-between md:justify-center">
          <div className="flex items-center justify-center gap-5 h-10 w-full">
            <img src="/PrettySkinLogo.png" alt="Pretty Skin" className="h-full w-auto object-contain" />
            <div className="h-6 w-px bg-stone-200 shrink-0"></div>
            <img src="/LamelinLogo.png" alt="Lamelin" className="h-full w-auto object-contain" />
          </div>
          {/* Mobile close button */}
          <button className="md:hidden p-1 text-stone-400 hover:bg-stone-100 rounded-full" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 py-6 space-y-8">
          {filteredMenuGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              <p className="px-8 text-[10px] font-bold text-stone-400 mb-3 tracking-[0.15em] uppercase">
                {group.group}
              </p>
              <nav className="px-4 space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isAccordion = !!item.subItems && item.subItems.length > 0;
                  const isOpen = openMenus[item.title];
                  
                  const isActiveDirect = !isAccordion && (
                    item.href === "/" 
                      ? pathname === "/" 
                      : pathname === item.href || pathname.startsWith(`${item.href}/`)
                  );

                  return (
                    <div key={item.title} className="space-y-1">
                      {isAccordion ? (
                        <>
                          <button 
                            onClick={() => toggleSidebarMenu(item.title)} 
                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                          >
                            <div className="flex items-center gap-3.5">
                              <Icon className="w-5 h-5 text-stone-400" />
                              {item.title}
                            </div>
                            <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                          </button>
                          {isOpen && (
                            <div className="pt-1 pb-2 space-y-1 animate-in slide-in-from-top-2 duration-200 ml-4 border-l border-stone-100 pl-4">
                              {item.subItems!.map((subItem) => {
                                const isSubActive = pathname === subItem.href;
                                return (
                                  <Link 
                                    key={subItem.title} 
                                    href={subItem.href}
                                    onClick={() => setIsMobileMenuOpen(false)} 
                                    className={`flex items-center px-4 py-2.5 rounded-lg text-sm transition-all font-medium ${isSubActive ? 'bg-stone-100 text-stone-900 font-bold' : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50'}`}
                                  >
                                    {subItem.title}
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </>
                      ) : (
                        <Link 
                          href={item.href!}
                          onClick={() => setIsMobileMenuOpen(false)} 
                          className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm transition-all font-medium ${isActiveDirect ? 'bg-stone-900 text-white shadow-lg' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}
                        >
                          <Icon className={`w-5 h-5 ${isActiveDirect ? "text-stone-300" : "text-stone-400"}`} />
                          {item.title}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        
        {/* RESPONSIVE HEADER */}
        <header className="h-16 sm:h-20 bg-white border-b border-stone-200 flex items-center justify-between px-4 sm:px-10 shrink-0 z-30">
          
          <div className="flex items-center gap-2 sm:gap-0 min-w-0">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex flex-col min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-stone-900 tracking-tight leading-tight truncate">
                {time.getHours() < 12 ? "Good morning" : time.getHours() < 17 ? "Good afternoon" : "Good evening"}, {userName}
              </h1>
              <div className="hidden sm:flex text-[11px] font-bold text-stone-400 uppercase tracking-widest gap-2 mt-1">
                <span>{time.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span>•</span>
                <span className="text-stone-900 font-black">[{time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}]</span>
              </div>
            </div>
          </div>

          <div className="relative shrink-0 ml-2">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
              className="flex items-center gap-2 sm:gap-3 hover:bg-stone-50 p-1.5 sm:p-2 sm:pr-4 rounded-full border border-stone-100 transition-all shadow-sm"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-stone-900 flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-xs sm:text-sm">{userName.charAt(0)}</span>
              </div>
              <span className="hidden sm:inline text-sm font-bold text-stone-700">{userName}</span>
              <ChevronDown className="hidden sm:block w-4 h-4 text-stone-400" />
            </button>

            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsDropdownOpen(false)} />
                <div className="absolute right-0 mt-3 w-52 bg-white border border-stone-200 shadow-2xl rounded-2xl py-2 z-40 animate-in fade-in slide-in-from-top-2">
                  <div className="px-5 py-3 border-b border-stone-100">
                    <p className="text-sm font-bold text-stone-900 truncate">{userName}</p>
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">{userRole || "Loading..."}</p>
                  </div>
                  <div className="p-1.5">
                    <button 
                      onClick={() => {setIsDropdownOpen(false); setIsSignOutModalOpen(true);}} 
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>
        
        <div className="flex-1 overflow-auto bg-stone-50/50 relative z-0">
          <div className="p-4 sm:p-10 w-full h-full">
            {children}
          </div>
        </div>
      </main>

      {isSignOutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/60 backdrop-blur-md p-4">
          <div className="absolute inset-0" onClick={() => setIsSignOutModalOpen(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl p-8 sm:p-10 max-w-sm w-full text-center border border-white">
            <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center mb-6 mx-auto">
              <AlertTriangle className="w-10 h-10 text-rose-600" />
            </div>
            <h3 className="text-2xl font-black text-stone-900 tracking-tighter">Sign Out?</h3>
            <p className="text-sm text-stone-500 mt-3 leading-relaxed font-medium">
              Are you sure you want to end your session? You will need to re-authenticate to access the portal.
            </p>
            <div className="mt-10 flex flex-col gap-3">
              <button onClick={confirmSignOut} className="w-full py-4 bg-rose-600 text-white font-bold rounded-2xl shadow-lg shadow-rose-200 transition-all active:scale-95">Yes, Sign Out</button>
              <button onClick={() => setIsSignOutModalOpen(false)} className="w-full py-4 bg-stone-100 text-stone-500 font-bold rounded-2xl transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}