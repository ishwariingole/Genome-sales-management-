import React, { useState, useEffect, useMemo } from 'react';
import { SaleRecord, SalespersonTarget, AuthUser, FilterState } from './types/sales';
import { realtimeStore } from './services/firebaseService';
import { Navbar } from './components/layout/Navbar';
import { LoginScreen } from './components/auth/LoginScreen';
import { ManageStaffModal } from './components/auth/ManageStaffModal';
import { FilterBar } from './components/dashboard/FilterBar';
import { ExecutiveSalesTable } from './components/dashboard/ExecutiveSalesTable';
import { MobileBillUpload } from './components/upload/MobileBillUpload';
import { ExcelBatchUpload } from './components/upload/ExcelBatchUpload';
import { SalesCopilotChat } from './components/ai/SalesCopilotChat';
import { SetTargetModal } from './components/dashboard/SetTargetModal';
import { matchesRecordMonth, parseRecordDateToIso, extractUniqueMonthsFromRecords } from './utils/dateUtils';
import { Filter, Calendar, User, Store, Sparkles, ChevronRight } from 'lucide-react';

const AUTH_STORAGE_KEY = 'genome_sales_auth_user_v1';

export const App: React.FC = () => {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Auth restore error:', e);
    }
    return {
      email: 'owner@genome.com',
      name: 'Business Owner',
      role: 'owner'
    };
  });

  // Data State (Kept in Backend / Memory & Cloud Firestore)
  const [salesRecords, setSalesRecords] = useState<SaleRecord[]>([]);
  const [targets, setTargets] = useState<SalespersonTarget[]>([]);

  // Filters State: Month (dropdown + from/to calendars), Salesperson, Party/Dealer, Search
  const [filters, setFilters] = useState<FilterState>({
    startDate: '',
    endDate: '',
    selectedMonth: '',
    partyName: '',
    region: '',
    state: '',
    reportingSales: '',
    salesPerson: '',
    brand: '',
    searchQuery: ''
  });

  // Table and data list should ONLY appear when a filter is actively selected
  const [isUnlockedWithoutFilter, setIsUnlockedWithoutFilter] = useState(false);

  // Modals
  const [isMobileUploadOpen, setIsMobileUploadOpen] = useState(false);
  const [isExcelUploadOpen, setIsExcelUploadOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isSetTargetOpen, setIsSetTargetOpen] = useState(false);

  // Subscribe to Cloud Firestore & real-time store
  useEffect(() => {
    const unsubSales = realtimeStore.subscribeToSales((updatedSales) => {
      setSalesRecords(updatedSales);
    });

    const unsubTargets = realtimeStore.subscribeToTargets((updatedTargets) => {
      setTargets(updatedTargets);
    });

    return () => {
      unsubSales();
      unsubTargets();
    };
  }, []);

  // Filter sales records based on active criteria
  const filteredRecords = useMemo(() => {
    return salesRecords.filter(r => {
      // 1. Month filter (e.g. "Aug-25", "Sep-25")
      if (filters.selectedMonth && !matchesRecordMonth(r, filters.selectedMonth)) {
        return false;
      }

      // 2. Calendar From & To Date Range (ISO YYYY-MM-DD comparison)
      if (filters.startDate || filters.endDate) {
        const recordIso = parseRecordDateToIso(r.date);
        if (recordIso) {
          if (filters.startDate && recordIso < filters.startDate) return false;
          if (filters.endDate && recordIso > filters.endDate) return false;
        }
      }

      // 3. Sales Person Filter
      if (filters.salesPerson && r.salesPerson.toLowerCase() !== filters.salesPerson.toLowerCase()) {
        return false;
      }

      // 4. Party / Dealer Filter
      if (filters.partyName && r.particulars.toLowerCase() !== filters.partyName.toLowerCase()) {
        return false;
      }

      // 5. Brand Filter
      if (filters.brand && r.brand.toLowerCase() !== filters.brand.toLowerCase()) {
        return false;
      }

      // 6. State Filter
      if (filters.state && r.state.toLowerCase() !== filters.state.toLowerCase()) {
        return false;
      }

      // 7. Search Query
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const matchesQuery =
          (r.particulars && r.particulars.toLowerCase().includes(q)) ||
          (r.city && r.city.toLowerCase().includes(q)) ||
          (r.state && r.state.toLowerCase().includes(q)) ||
          (r.salesPerson && r.salesPerson.toLowerCase().includes(q)) ||
          (r.invoiceNo && r.invoiceNo.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [salesRecords, filters]);

  // Available metadata for quick filter prompts
  const availableMonths = useMemo(() => {
    return extractUniqueMonthsFromRecords(salesRecords);
  }, [salesRecords]);

  const uniqueSalesPersons = useMemo(() => {
    return Array.from(new Set(salesRecords.map(r => r.salesPerson).filter(Boolean))).sort();
  }, [salesRecords]);

  const uniqueParties = useMemo(() => {
    return Array.from(new Set(salesRecords.map(r => r.particulars).filter(Boolean))).sort();
  }, [salesRecords]);

  // Check if any filter is currently applied
  const hasActiveFilters = Boolean(
    filters.selectedMonth ||
    filters.startDate ||
    filters.endDate ||
    filters.salesPerson ||
    filters.partyName ||
    filters.brand ||
    filters.state ||
    filters.searchQuery
  );

  // Data list and table ONLY appear after applying a filter
  const shouldShowData = Boolean(hasActiveFilters || isUnlockedWithoutFilter);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    const hasAny = Boolean(
      newFilters.selectedMonth ||
      newFilters.startDate ||
      newFilters.endDate ||
      newFilters.salesPerson ||
      newFilters.partyName ||
      newFilters.brand ||
      newFilters.state ||
      newFilters.searchQuery
    );
    if (!hasAny) {
      setIsUnlockedWithoutFilter(false);
    }
  };

  const handleLogin = (user: AuthUser) => {
    setCurrentUser(user);
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } catch (e) {}
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {}
  };

  // If not authenticated, render Login Screen
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const isOwner = currentUser.role === 'owner';
  const staffName = currentUser.name || 'Accountant';

  return (
    <div className="min-h-screen bg-transparent text-[#F8FAFC] flex flex-col font-sans selection:bg-[#387BFF] selection:text-white relative overflow-x-hidden">
      
      {/* Dynamic Ambient Blurry Aurora & Floating Glow Orbs (Behind Glass) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Top-Left: Large Glowing Royal Blue Orb */}
        <div className="absolute -top-40 -left-40 w-[620px] h-[620px] rounded-full bg-gradient-to-br from-[#387BFF] to-[#1D4ED8] opacity-35 blur-[125px] pointer-events-none"></div>

        {/* Top-Right: Electric Violet / Purple Glow */}
        <div className="absolute -top-20 -right-32 w-[580px] h-[580px] rounded-full bg-gradient-to-bl from-[#8B5CF6] via-[#7C3AED] to-[#4F46E5] opacity-30 blur-[130px] pointer-events-none"></div>

        {/* Mid-Left: Hot Magenta / Pink Light */}
        <div className="absolute top-[35%] -left-36 w-[550px] h-[550px] rounded-full bg-gradient-to-tr from-[#EC4899] to-[#F43F5E] opacity-25 blur-[140px] pointer-events-none"></div>

        {/* Mid-Right: Electric Cyan / Sky Blue Glow */}
        <div className="absolute top-[50%] -right-36 w-[600px] h-[600px] rounded-full bg-gradient-to-bl from-[#00F2FE] via-[#387BFF] to-[#6366F1] opacity-25 blur-[140px] pointer-events-none"></div>

        {/* Bottom-Center: Neon Mint & Emerald Aurora */}
        <div className="absolute bottom-10 left-[20%] w-[700px] h-[450px] rounded-full bg-gradient-to-tr from-[#10E599] via-[#06B6D4] to-[#387BFF] opacity-20 blur-[150px] pointer-events-none"></div>

        {/* Fine Glass Specular Grid Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] opacity-70 pointer-events-none"></div>
      </div>

      {/* Sticky Header with User Auth & Quick Upload Buttons */}
      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenMobileUpload={() => setIsMobileUploadOpen(true)}
        onOpenExcelUpload={() => setIsExcelUploadOpen(true)}
        onOpenSetTarget={() => setIsSetTargetOpen(true)}
        onToggleAiCopilot={() => setIsAiOpen(prev => !prev)}
        onOpenManageStaff={() => setIsStaffModalOpen(true)}
        isAiOpen={isAiOpen}
        totalRecordsCount={salesRecords.length}
      />

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA: FILTER BAR + (ZERO-STATE PROMPT OR EXECUTIVES TABLE)    */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2 sm:px-6 py-3 sm:py-5 relative z-10 flex flex-col justify-start">
        {/* IF NO FILTER IS APPLIED: ZERO-STATE PROMPT SCREEN (DO NOT SHOW DATA ON OPEN) */}
        {!shouldShowData ? (
          <div className="space-y-4 sm:space-y-6">
            <FilterBar
              filters={filters}
              onFilterChange={handleFilterChange}
              allRecords={salesRecords}
              mode="sales_management"
              isCombined={false}
            />

            <div className="glass-panel rounded-3xl p-6 sm:p-10 border-2 border-white/10 shadow-2xl text-center space-y-6 sm:space-y-8 bg-gradient-to-b from-[#0E1628]/95 via-[#0B1020]/95 to-[#070A12]/98 backdrop-blur-2xl">
            
            {/* Header info */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-[#387BFF]/25 via-[#8B5CF6]/25 to-[#10E599]/25 border-2 border-[#387BFF]/40 text-[#60A5FA] flex items-center justify-center text-3xl shadow-2xl shadow-[#387BFF]/30 mb-4 animate-pulse">
                <Filter className="w-8 h-8 sm:w-10 sm:h-10 text-[#387BFF]" />
              </div>
              <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight">
                Select a Filter to Reveal Sales Data
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto mt-2 font-medium">
                The sales table is hidden by default. Choose a <strong className="text-[#60A5FA]">Calendar Month</strong>, <strong className="text-[#C084FC]">Sales Person</strong>, or <strong className="text-[#10E599]">Party / Dealer</strong> in the filter bar above to immediately load and display data.
              </p>
            </div>

            {/* 3 Quick-Tap Interactive Guide Cards with 3D Depth */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 text-left max-w-4xl mx-auto perspective-1000">
              
              {/* 1. Quick Month Select */}
              <div className="glass-well card-3d p-4 sm:p-5 rounded-2xl border border-[#387BFF]/30 hover:border-[#387BFF]/70 transition-all bg-gradient-to-b from-[#387BFF]/10 to-transparent flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-black text-white mb-1.5">
                    <Calendar className="w-4 h-4 text-[#387BFF]" />
                    <span>1. Tap a Month</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-3 font-medium">
                    Instantly load that month's billing:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableMonths.slice(0, 4).map(m => (
                      <button
                        key={m}
                        onClick={() => handleFilterChange({ ...filters, selectedMonth: m })}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-black bg-[#387BFF]/20 hover:bg-[#387BFF] text-[#60A5FA] hover:text-white border border-[#387BFF]/40 transition-all active:scale-95 shadow-sm"
                      >
                        📅 {m}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 mt-3.5 block font-medium">
                  {availableMonths.length} billing cycles stored
                </span>
              </div>

              {/* 2. Quick Sales Rep Select */}
              <div className="glass-well card-3d p-4 sm:p-5 rounded-2xl border border-[#8B5CF6]/30 hover:border-[#8B5CF6]/70 transition-all bg-gradient-to-b from-[#8B5CF6]/10 to-transparent flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-black text-white mb-1.5">
                    <User className="w-4 h-4 text-[#8B5CF6]" />
                    <span>2. Tap a Sales Rep</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-3 font-medium">
                    Inspect party accounts & quota:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {uniqueSalesPersons.slice(0, 4).map(sp => (
                      <button
                        key={sp}
                        onClick={() => handleFilterChange({ ...filters, salesPerson: sp })}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-black bg-[#8B5CF6]/20 hover:bg-[#8B5CF6] text-[#C084FC] hover:text-white border border-[#8B5CF6]/40 transition-all active:scale-95 shadow-sm"
                      >
                        👤 {sp}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 mt-3.5 block font-medium">
                  {uniqueSalesPersons.length} sales representatives active
                </span>
              </div>

              {/* 3. Quick Dealer Select */}
              <div className="glass-well card-3d p-4 sm:p-5 rounded-2xl border border-[#10E599]/30 hover:border-[#10E599]/70 transition-all bg-gradient-to-b from-[#10E599]/10 to-transparent flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-black text-white mb-1.5">
                    <Store className="w-4 h-4 text-[#10E599]" />
                    <span>3. Tap a Top Dealer</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-3 font-medium">
                    Filter by a verified customer:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {uniqueParties.slice(0, 3).map(p => (
                      <button
                        key={p}
                        onClick={() => handleFilterChange({ ...filters, partyName: p })}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-black bg-[#10E599]/20 hover:bg-[#10E599] text-[#6EE7B7] hover:text-slate-950 border border-[#10E599]/40 transition-all active:scale-95 truncate max-w-[190px] shadow-sm"
                        title={p}
                      >
                        🏬 {p}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 mt-3.5 block font-medium">
                  {uniqueParties.length} dealer accounts available
                </span>
              </div>

            </div>

          </div>
        </div>
      ) : (
          /* COMBINED UNIFIED CARD: FILTER CONTROLS + EXECUTIVE SALES TABLE WITH ZERO GAP */
          <div className="glass-panel rounded-3xl border-2 border-white/15 shadow-2xl bg-gradient-to-br from-[#0B1020]/95 via-[#111933]/95 to-[#162142]/95 backdrop-blur-2xl overflow-hidden divide-y divide-white/10">
            <FilterBar
              filters={filters}
              onFilterChange={handleFilterChange}
              allRecords={salesRecords}
              mode="sales_management"
              isCombined={true}
            />
            <ExecutiveSalesTable
              records={filteredRecords}
              allRecords={salesRecords}
              targets={targets}
              filters={filters}
              onFilterChange={handleFilterChange}
              isOwner={isOwner}
              isCombined={true}
            />
          </div>
        )}
      </main>

      {/* Simple Glass Footer */}
      <footer className="bg-[#070A12]/85 backdrop-blur-2xl border-t border-white/[0.08] py-4 text-center text-xs text-slate-400 relative z-10">
        <p>Genome Signature • Raylux • Automotive Lighting Intelligence System</p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Backend Cloud Firestore: <span className="font-mono text-[#387BFF]">sales-b275d</span> ({salesRecords.length} Raw Invoices Stored)
        </p>
      </footer>

      {/* Floating Upload Modals & AI Chat (Appear on top when clicked) */}
      <MobileBillUpload
        isOpen={isMobileUploadOpen}
        onClose={() => setIsMobileUploadOpen(false)}
        currentStaffName={isOwner ? 'Ashok' : staffName}
      />

      <ExcelBatchUpload
        isOpen={isExcelUploadOpen}
        onClose={() => setIsExcelUploadOpen(false)}
      />

      <ManageStaffModal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
      />

      <SalesCopilotChat
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        sales={salesRecords}
        targets={targets}
      />

      <SetTargetModal
        isOpen={isSetTargetOpen}
        onClose={() => setIsSetTargetOpen(false)}
        salesRecords={salesRecords}
        targets={targets}
        defaultRep={filters.salesPerson}
        defaultParty={filters.partyName}
        defaultCategory={filters.partyName ? 'distributor' : 'salesperson'}
        defaultMonth={filters.selectedMonth}
      />
    </div>
  );
};

export default App;
