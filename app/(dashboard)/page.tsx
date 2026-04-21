"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Users, AlertTriangle, Package, Loader2, ArrowRight, Store, Building2, Clock, Receipt, Banknote, LineChart, Calendar } from "lucide-react";
import { getDashboardMetricsAction } from "@/lib/actions/dashboard";
import Link from "next/link";

export default function MainDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    const fetchMetrics = async () => {
      setIsLoading(true);
      const res = await getDashboardMetricsAction(selectedMonth, selectedYear);
      if (res.data) setMetrics(res.data);
      setIsLoading(false);
    };
    fetchMetrics();
  }, [selectedMonth, selectedYear]);

  if (isLoading && !metrics) {
    return (
      <div className="w-full h-[calc(100vh-8rem)] flex flex-col items-center justify-center text-stone-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-600" />
        <p className="text-sm font-medium">Synchronizing financial ledger...</p>
      </div>
    );
  }

  const maxChartValue = metrics ? Math.max(...metrics.chartData.map((d: any) => d.total), 5000) : 1;
  const currentMonthName = new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' });
  
  // Dynamic Profit/Loss Calculation
  const netSales = metrics?.netSales || 0;
  const isProfit = netSales >= 0;

  return (
    <div className="w-full animate-in fade-in duration-500 pb-10 flex flex-col gap-6">
      
      {/* HEADER & FILTERS */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-stone-900 tracking-tight">Executive Overview</h1>
          <p className="text-sm text-stone-500 mt-1">Live operational and financial heartbeat for Prettyskin Lamelin.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-2 pl-3 border-r border-stone-100 pr-2">
            <Calendar className="w-4 h-4 text-stone-400" />
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-transparent text-sm font-bold text-stone-700 focus:outline-none cursor-pointer appearance-none">
              {Array.from({length: 12}, (_, i) => (
                <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'short' })}</option>
              ))}
            </select>
          </div>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-transparent text-sm font-bold text-stone-700 pr-3 focus:outline-none cursor-pointer appearance-none">
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
            <option value={2024}>2024</option>
          </select>
        </div>
      </div>

      {/* --- TOP KPI ROW (Financial Breakout) --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2 text-stone-500 font-bold text-[11px] uppercase tracking-wider">
              <TrendingUp className="w-4 h-4" /> Gross Sales
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-stone-900 tracking-tight">₱{metrics?.grossSales?.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
            <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-stone-400">
              <span className="text-blue-500">Retail: ₱{metrics?.retailRevenue?.toLocaleString()}</span> • <span className="text-purple-500">B2B: ₱{metrics?.b2bRevenue?.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2 text-rose-500 font-bold text-[11px] uppercase tracking-wider">
              <Receipt className="w-4 h-4" /> Total Expenses
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-black text-rose-600 tracking-tight">- ₱{metrics?.totalExpenses?.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
            <p className="text-xs font-medium text-stone-500 mt-2">Deducted from gross</p>
          </div>
        </div>

        {/* DYNAMIC PROFIT/LOSS CARD */}
        <div className={`${isProfit ? 'bg-emerald-500' : 'bg-rose-500'} p-6 rounded-3xl shadow-sm flex flex-col justify-between text-white relative overflow-hidden transition-colors duration-300`}>
          <div className="absolute -right-4 -top-4 opacity-10"><Banknote className="w-32 h-32" /></div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div className={`flex items-center gap-2 font-bold text-[11px] uppercase tracking-wider ${isProfit ? 'text-emerald-100' : 'text-rose-100'}`}>
              <LineChart className="w-4 h-4" /> Net Sales
            </div>
          </div>
          <div className="relative z-10">
            <h3 className="text-3xl font-black tracking-tight">₱{netSales.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
            <p className={`text-xs font-medium mt-2 ${isProfit ? 'text-emerald-100' : 'text-rose-100'}`}>{currentMonthName} {isProfit ? 'Profit' : 'Loss'}</p>
          </div>
        </div>

        {/* Foot Traffic & Low Stock Combined Card */}
        <div className="grid grid-rows-2 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-0.5">Today's Traffic</p>
              <h3 className="text-xl font-black text-stone-900">{metrics?.todayWalkIn + metrics?.todayRegistered} <span className="text-xs font-bold text-stone-400">Pax</span></h3>
            </div>
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center"><Users className="w-5 h-5"/></div>
          </div>
          <div className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between ${metrics?.lowStockAlerts?.length > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-stone-200'}`}>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${metrics?.lowStockAlerts?.length > 0 ? 'text-rose-400' : 'text-stone-400'}`}>Low Stock Alerts</p>
              <h3 className={`text-xl font-black ${metrics?.lowStockAlerts?.length > 0 ? 'text-rose-600' : 'text-stone-900'}`}>{metrics?.lowStockAlerts?.length} <span className="text-xs font-bold opacity-50">Items</span></h3>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${metrics?.lowStockAlerts?.length > 0 ? 'bg-rose-100 text-rose-600' : 'bg-stone-50 text-stone-400'}`}><AlertTriangle className="w-5 h-5"/></div>
          </div>
        </div>

      </div>

      {/* --- MIDDLE ROW: MONTHLY CHART & LIVE FEED --- */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* WIDE MONTHLY CHART */}
        <div className="xl:col-span-2 bg-white rounded-3xl border border-stone-200 shadow-sm p-6 flex flex-col relative">
          
          {isLoading && (
            <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-[2px] flex items-center justify-center rounded-3xl">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          )}

          <div className="flex justify-between items-center mb-8 z-10">
            <div>
              <h3 className="text-lg font-bold text-stone-900">{currentMonthName} Daily Trend</h3>
              <p className="text-xs text-stone-500 mt-1">Gross sales broken down by day</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-stone-500 uppercase tracking-wider"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500"></span> Retail</div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-stone-500 uppercase tracking-wider"><span className="w-2.5 h-2.5 rounded-sm bg-purple-500"></span> B2B</div>
            </div>
          </div>

          {/* FIXED HEIGHT COLLAPSE: Set absolute height for chart container */}
          <div className="flex-1 flex items-end justify-between gap-1 h-64 mt-auto pb-6 relative px-2 z-10">
            
            {/* Background Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between border-b border-stone-200 pb-10 pointer-events-none z-0">
              <div className="border-t border-stone-100 w-full flex items-start"><span className="text-[9px] font-mono text-stone-300 -mt-2 bg-white pr-2">₱{maxChartValue.toLocaleString()}</span></div>
              <div className="border-t border-stone-100 w-full flex items-start"><span className="text-[9px] font-mono text-stone-300 -mt-2 bg-white pr-2">₱{(maxChartValue * 0.75).toLocaleString()}</span></div>
              <div className="border-t border-stone-100 w-full flex items-start"><span className="text-[9px] font-mono text-stone-300 -mt-2 bg-white pr-2">₱{(maxChartValue * 0.5).toLocaleString()}</span></div>
              <div className="border-t border-stone-100 w-full flex items-start"><span className="text-[9px] font-mono text-stone-300 -mt-2 bg-white pr-2">₱{(maxChartValue * 0.25).toLocaleString()}</span></div>
            </div>

            {metrics?.chartData?.map((day: any, i: number) => {
              const retailHeight = (day.retail / maxChartValue) * 100;
              const b2bHeight = (day.b2b / maxChartValue) * 100;
              const hasData = day.total > 0;
              
              return (
                <div key={i} className="flex flex-col items-center justify-end flex-1 group z-10 relative h-full pt-8">
                  {/* Tooltip on Hover */}
                  {hasData && (
                    <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity text-center pointer-events-none z-50">
                      <p className="text-[10px] font-bold text-stone-900 bg-white shadow-lg rounded px-2 py-1 whitespace-nowrap border border-stone-100">
                        ₱{day.total.toLocaleString()}
                      </p>
                    </div>
                  )}
                  
                  {/* The Bar */}
                  <div className={`w-full max-w-[16px] h-full bg-stone-50 rounded-t-sm flex flex-col justify-end overflow-hidden ${hasData ? 'hover:brightness-95 cursor-pointer' : ''}`}>
                    <div className="w-full bg-purple-500 transition-all duration-700" style={{ height: `${b2bHeight}%` }}></div>
                    <div className="w-full bg-blue-500 transition-all duration-700" style={{ height: `${retailHeight}%` }}></div>
                  </div>
                  
                  {/* Day Number Label */}
                  <p className="text-[9px] font-bold text-stone-400 mt-2 shrink-0">{day.day}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* RECENT TRANSACTIONS LIVE FEED */}
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm flex flex-col overflow-hidden h-[420px]">
          <div className="p-5 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-stone-900 flex items-center gap-2"><Clock className="w-4 h-4 text-stone-400" /> Recent Transactions</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {metrics?.recentTransactions?.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-400 text-center p-6">
                <Receipt className="w-10 h-10 text-stone-200 mb-3" />
                <p className="text-sm font-bold text-stone-600">No recent sales</p>
              </div>
            ) : (
              <div className="space-y-1">
                {metrics?.recentTransactions?.map((tx: any, idx: number) => {
                  const isRetail = tx.type === 'Retail';
                  return (
                    <div key={idx} className="p-3 hover:bg-stone-50 rounded-xl transition-colors flex items-center justify-between group cursor-default">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isRetail ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                          {isRetail ? <Store className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-stone-900 leading-tight">{tx.ref}</p>
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mt-0.5">{tx.type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-stone-900">₱{tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                        <p className="text-[10px] text-stone-400 mt-0.5">{new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric'})} • {new Date(tx.date).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}