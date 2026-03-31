'use client';

/**
 * =====================================================
 * PAYROLL PAGE - Redesigned
 * =====================================================
 * Section 1: Week Selector + Generate/Preview
 * Section 2: Site Summary Cards
 * Section 3: Worker Payroll Cards (collapsible)
 * Section 4: Payroll Summary
 *
 * All data from real Firebase queries - zero mocks.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Users,
  Clock,
  TrendingUp,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Wallet,
  Building2,
  AlertCircle,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getPayrollsForWeek,
  generateWeeklyPayroll,
  markAsPaid,
  updatePayrollStatus,
  getSimpleAttendanceForDateRange,
  getActiveEmployees,
  getAllSites,
  getAllPendingAdvances,
  markAdvanceDeducted,
} from '@/services';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { calculateOtRate } from "@/domain/payroll";
import {
  buildAttendanceEntries,
  buildEmployeeSummaries,
  buildSiteTotals,
  buildGrandTotals,
} from "@/domain/payroll/aggregation";
import { groupAdvancesByEmployee, calculateSelectedAdvanceDeductions } from "@/domain/advances/grouping";
import { WorkerPayrollCard } from '@/components/payroll/WorkerPayrollCard';
import { SitePayrollCard } from '@/components/payroll/SitePayrollCard';
import { PayrollSummary } from '@/components/payroll/PayrollSummary';
import { buildSiteWorkerSummaries } from '@/domain/payroll/site-workers';
import {
  formatDate,
  getWeekNumber,
  getWeekStart,
  getWeekEnd,
  toISODateString,
  addWeeks,
  subWeeks,
} from '@/lib/date-utils';
import type {
  PayrollStatus,
  UserRole,
  WeeklyPayroll,
  SimpleAttendance,
  UserProfile,
  SiteBreakdown,
  SitePayrollTotal,
  Advance,
  AdvanceRequest,
  WorkSite,
} from '@/types';

// =====================================================
// CONSTANTS
// =====================================================

const statusConfig: Record<PayrollStatus, {
  label: string;
  color: string;
  icon: React.ReactNode;
}> = {
  draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: <FileText className="h-3.5 w-3.5" /> },
  pending_approval: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <Clock className="h-3.5 w-3.5" /> },
  approved: { label: 'Approved', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <CheckCircle className="h-3.5 w-3.5" /> },
  paid: { label: 'Paid', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <Wallet className="h-3.5 w-3.5" /> },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <XCircle className="h-3.5 w-3.5" /> },
};

const roleBadgeColors: Record<UserRole, string> = {
  owner: 'bg-purple-500/20 text-purple-400',
  ceo: 'bg-blue-500/20 text-blue-400',
  manager: 'bg-cyan-500/20 text-cyan-400',
  supervisor: 'bg-green-500/20 text-green-400',
  draughtsman: 'bg-yellow-500/20 text-yellow-400',
  bass: 'bg-orange-500/20 text-orange-400',
  helper: 'bg-gray-500/20 text-gray-400',
};

// =====================================================
// TYPES
// =====================================================

interface EmployeeWeekSummary {
  employeeId: string;
  employeeName: string;
  employeeRole: UserRole;
  daysWorked: number;
  otHours: number;
  grossPay: number;
  dailyRate: number;
  otRate: number;
  siteBreakdowns: SiteBreakdown[];
  advances: Advance[];
}

// =====================================================
// MAIN PAGE
// =====================================================

export default function PayrollPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthorized, user } = useRequireRole(['owner', 'ceo', 'manager']);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  // Track which advances the CEO has checked for deduction (advanceId -> boolean)
  const [deductionSelections, setDeductionSelections] = useState<Record<string, boolean>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Week boundaries (Monday start through Sunday end)
  const weekStart = getWeekStart(selectedDate);
  const weekEnd = getWeekEnd(selectedDate);
  const weekNumber = getWeekNumber(selectedDate);

  const weekStartStr = toISODateString(weekStart);
  const weekEndStr = toISODateString(weekEnd);

  // Initialize deduction selections from localStorage on mount
  useEffect(() => {
    const key = `payroll-deductions-${weekStartStr}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        setDeductionSelections(JSON.parse(stored));
      } catch (e) {
        setDeductionSelections({});
      }
    } else {
      setDeductionSelections({});
    }
    setIsLoaded(true);
  }, [weekStartStr]);

  // Persist deduction selections to localStorage whenever they change
  useEffect(() => {
    if (!isLoaded) return; // Wait for initial load
    const key = `payroll-deductions-${weekStartStr}`;
    localStorage.setItem(key, JSON.stringify(deductionSelections));
  }, [deductionSelections, weekStartStr, isLoaded]);

  // ---- DATA QUERIES (all real Firebase data) ----

  const { data: weekAttendance = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ['week-attendance', weekStartStr, weekEndStr],
    queryFn: () => getSimpleAttendanceForDateRange(weekStartStr, weekEndStr),
    staleTime: 30 * 1000, // 30 seconds - refresh frequently for accurate payroll
    gcTime: 5 * 60 * 1000, // 5 minutes background cache
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['active-employees'],
    queryFn: getActiveEmployees,
  });

  const { data: sites = [] } = useQuery({
    queryKey: ['all-sites'],
    queryFn: getAllSites,
  });

  const { data: payrollRecords = [], isLoading: loadingPayroll } = useQuery({
    queryKey: ['weekly-payroll', weekStartStr],
    queryFn: () => getPayrollsForWeek(weekStartStr),
  });

  // Fetch ALL pending advances in one query - grouped by worker in memory
  const { data: pendingAdvances = [] } = useQuery({
    queryKey: ['pending-advances'],
    queryFn: getAllPendingAdvances,
  });

  // Auto-check all un-deducted advances for deduction
  useEffect(() => {
    if (!isLoaded || pendingAdvances.length === 0) return;

    // Check if current selections state is truly empty (no advances checked)
    const selectedAdvances = Object.values(deductionSelections).filter(Boolean).length;

    if (selectedAdvances === 0) {
      const autoSelections: Record<string, boolean> = {};
      pendingAdvances.forEach(adv => {
        // Auto-check only approved, un-deducted advances
        if (!adv.deducted && adv.status === 'approved') {
          autoSelections[adv.id] = true;
          console.log(`✅ [AUTO-CHECK] ${adv.id}: ${adv.amount} LKR (status=${adv.status})`);
        }
      });

      if (Object.keys(autoSelections).length > 0) {
        console.log(`📊 [AUTO-SELECTIONS] Found ${Object.keys(autoSelections).length} un-deducted advances - auto-checking them`);
        setDeductionSelections(autoSelections);
      }
    } else {
      console.log(`📝 [AUTO-SELECTIONS SKIPPED] ${selectedAdvances} advances already selected`);
    }
  }, [pendingAdvances, isLoaded, deductionSelections]);

  // Debug: log fetched advances
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log(`📊 [PAYROLL DEBUG] Fetched advances: count=${pendingAdvances.length}`);
      if (pendingAdvances.length > 0) {
        pendingAdvances.forEach(a => {
          console.log(`   → ${a.id}: emp=${a.employeeId}, amt=${a.amount}, status=${a.status}, deducted=${a.deducted}`);
        });
      } else {
        console.log('   ❌ NO ADVANCES FOUND IN DATABASE');
      }
    }
  }, [pendingAdvances]);

  const hasPayrollGenerated = payrollRecords.length > 0;

  // ---- BUILD MAPS ----

  const employeeMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    employees.forEach(emp => {
      map.set(emp.workerId || emp.uid, emp);
      if (emp.workerId) map.set(emp.uid, emp);
    });
    return map;
  }, [employees]);

  const siteNameMap = useMemo(() => {
    const map = new Map<string, string>();
    sites.forEach((site: WorkSite) => map.set(site.id, site.name));
    return map;
  }, [sites]);

  // Group advances by employeeId
  const advancesByEmployee = useMemo(() => {
    const grouped = groupAdvancesByEmployee(pendingAdvances);
    if (typeof window !== 'undefined' && grouped.size > 0) {
      console.log('📊 [PAYROLL DEBUG] Advances grouped by employee:', {
        mapSize: grouped.size,
        entries: Array.from(grouped.entries()).map(([empId, advs]) => ({
          employeeId: empId,
          count: advs.length,
          advances: advs.map(a => ({ id: a.id, amount: a.amount })),
        })),
      });
    }
    return grouped;
  }, [pendingAdvances]);

  // ---- TOGGLE EXPAND ----

  const toggleWorkerExpanded = useCallback((workerId: string) => {
    setExpandedWorkers(prev => {
      const next = new Set(prev);
      if (next.has(workerId)) next.delete(workerId);
      else next.add(workerId);
      return next;
    });
  }, []);

  // ---- ADVANCE DEDUCTION CHECKBOX ----

  const toggleDeduction = useCallback((advanceId: string) => {
    setDeductionSelections(prev => ({
      ...prev,
      [advanceId]: !prev[advanceId],
    }));
  }, []);

  // ---- COMPUTE EMPLOYEE SUMMARIES (using domain engine) ----

  const employeeSummaries = useMemo((): EmployeeWeekSummary[] => {
    const entries = buildAttendanceEntries(weekAttendance, employeeMap);
    const summaries = buildEmployeeSummaries(entries, employeeMap, siteNameMap, advancesByEmployee) as unknown as EmployeeWeekSummary[];

    // DEBUG: Check what advances made it into summaries
    if (typeof window !== 'undefined') {
      const totalAdv = summaries.reduce((sum, e) => sum + e.advances.length, 0);
      console.log(`📊 [EMPLOYEE SUMMARIES] Built ${summaries.length} summaries, total advances: ${totalAdv}`);
      summaries.forEach(s => {
        if (s.advances.length > 0) {
          console.log(`   → ${s.employeeName}: ${s.advances.length} advances = ${s.advances.reduce((sum, a) => sum + a.amount, 0)} LKR`);
        }
      });
    }

    return summaries;
  }, [weekAttendance, employeeMap, siteNameMap, advancesByEmployee]);

  // ---- SITE TOTALS (using domain engine) ----

  const siteTotals = useMemo(() => {
    // buildSiteTotals already computes accurate totalDays and totalOtHours
    // Don't recalculate - they're already correct and include all merged/deduplicated data
    return buildSiteTotals(employeeSummaries);
  }, [employeeSummaries]);

  // ---- SITE-WORKER SUMMARIES (for enhanced UI display) ----

  const siteWorkerSummaries = useMemo(() => {
    // Build site-worker breakdown for detailed summary display
    // This is UI-only transformation - no payroll changes
    return buildSiteWorkerSummaries(employeeSummaries);
  }, [employeeSummaries]);

  // ---- GRAND TOTALS (using domain engine) ----

  const grandTotals = useMemo(() => {
    const advanceDeductions = calculateSelectedAdvanceDeductions(employeeSummaries, deductionSelections);
    if (typeof window !== 'undefined') {
      const empWithAdv = employeeSummaries.filter(e => e.advances.length > 0);
      const totalAdv = employeeSummaries.reduce((sum, e) => sum + e.advances.length, 0);
      console.log(`📊 [GRAND TOTALS] employees with advances: ${empWithAdv.length}, total advances: ${totalAdv}, selected deduction: ${advanceDeductions} LKR`);
      if (totalAdv > 0 && advanceDeductions === 0) {
        console.log('   ⚠️ Advances exist but selected deduction is 0 - no advances marked for deduction');
      }
    }
    return buildGrandTotals(employeeSummaries, advanceDeductions);
  }, [employeeSummaries, deductionSelections]);

  // ---- FILTER ----

  const filteredSummaries = employeeSummaries.filter(s =>
    (!searchQuery || s.employeeName.toLowerCase().includes(searchQuery.toLowerCase())) &&
    s.grossPay > 0  // Hide workers with zero payment
  );
  const filteredPayroll = payrollRecords.filter(r =>
    (!searchQuery || r.employeeName.toLowerCase().includes(searchQuery.toLowerCase())) &&
    r.netPay > 0  // Hide workers with zero payment
  );

  // ---- MUTATIONS ----

  const generateMutation = useMutation({
    mutationFn: () => {
      const selectedAdvances = Object.entries(deductionSelections)
        .filter(([_, isSelected]) => isSelected)
        .map(([advanceId, _]) => advanceId);

      // DEBUG: Log selected advances before generating
      if (typeof window !== 'undefined') {
        console.log(`🔥 [GENERATE PAYROLL] Selected advances for deduction:`, {
          count: selectedAdvances.length,
          ids: selectedAdvances,
          deductionSelections
        });
      }

      return generateWeeklyPayroll(weekStart, user?.uid || '', undefined, selectedAdvances);
    },
    onSuccess: (data) => {
      toast({
        title: 'Payroll Generated',
        description: `Generated payroll for ${data.success} employees.${data.failed > 0 ? ` ${data.failed} failed.` : ''}`,
      });
      setShowPreview(false);
      setDeductionSelections({}); // Clear selections after successful generation
      const key = `payroll-deductions-${weekStartStr}`;
      localStorage.removeItem(key); // Clear from storage
      queryClient.invalidateQueries({ queryKey: ['weekly-payroll'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to generate payroll', variant: 'destructive' });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (payrollId: string) => markAsPaid(payrollId, 'cash'),
    onSuccess: () => {
      toast({ title: 'Marked as Paid' });
      queryClient.invalidateQueries({ queryKey: ['weekly-payroll'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (payrollId: string) => updatePayrollStatus(payrollId, 'approved'),
    onSuccess: () => {
      toast({ title: 'Approved' });
      queryClient.invalidateQueries({ queryKey: ['weekly-payroll'] });
    },
  });

  const navigateWeek = (direction: 'prev' | 'next') => {
    setSelectedDate(current =>
      direction === 'prev' ? subWeeks(current, 1) : addWeeks(current, 1)
    );
    setShowPreview(false);
  };

  const isLoading = loadingAttendance || loadingPayroll;

  if (!isAuthorized) return null;

  return (
    <div className="space-y-6">

      {/* ========== SECTION 1: WEEK SELECTOR ========== */}
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Payroll</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Weekly salary tracking &mdash; Pay day every Saturday
          </p>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-wrap shrink-0">
          <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')} className="h-9 w-9 p-0 sm:h-10 sm:w-10">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 rounded-md border border-border bg-background px-2 sm:px-3 py-1.5 text-xs sm:text-sm">
            <span className="font-medium flex items-center gap-0.5 sm:gap-1">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              Week {weekNumber}
            </span>
            <span className="text-xs text-muted-foreground line-clamp-2">
              ({formatDate(weekStart, 'DATE_SHORT')} - {formatDate(weekEnd, 'DATE_SHORT')})
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigateWeek('next')} className="h-9 w-9 p-0 sm:h-10 sm:w-10">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Status + Actions Bar */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className={cn(
                'inline-flex items-center gap-1.5 sm:gap-2 rounded-full border px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium',
                hasPayrollGenerated
                  ? 'border-green-500/30 bg-green-500/10 text-green-500'
                  : 'border-blue-500/30 bg-blue-500/10 text-blue-500'
              )}>
                {hasPayrollGenerated ? (
                  <><CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" /> Payroll Generated</>
                ) : (
                  <><Clock className="h-3 w-3 sm:h-4 sm:w-4" /> Live Preview</>
                )}
              </div>
              <span className="text-xs sm:text-sm text-muted-foreground">
                {grandTotals.totalWorkers} workers
              </span>
            </div>

            {!hasPayrollGenerated && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
                {!showPreview ? (
                  <Button
                    variant="outline"
                    className="gap-2 text-xs sm:text-sm"
                    size="sm"
                    onClick={() => setShowPreview(true)}
                    disabled={employeeSummaries.length === 0}
                  >
                    <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Preview Payroll</span>
                    <span className="sm:hidden">Preview</span>
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs sm:text-sm"
                      onClick={() => setShowPreview(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="gap-2 text-xs sm:text-sm"
                      size="sm"
                      onClick={() => generateMutation.mutate()}
                      disabled={generateMutation.isPending}
                    >
                      {generateMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      )}
                      <span className="hidden sm:inline">Approve &amp; Generate</span>
                      <span className="sm:hidden">Generate</span>
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* ========== SECTION 2: SITE SUMMARY CARDS ========== */}
          {siteTotals.length > 0 && (
            <div>
              <h2 className="mb-2 sm:mb-3 text-base sm:text-lg font-semibold text-foreground">Site Summary</h2>
              <div className="grid gap-2 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {siteTotals.map((st) => (
                  <SitePayrollCard
                    key={st.siteId}
                    siteId={st.siteId}
                    siteName={st.siteName}
                    workerCount={st.workerCount}
                    totalDays={st.totalDays}
                    totalOtHours={st.totalOtHours}
                    totalPayroll={st.totalPayroll}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ========== SECTION 3: WORKER PAYROLL CARDS ========== */}
          <div>
            <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
              <h2 className="text-base sm:text-lg font-semibold text-foreground">
                {hasPayrollGenerated ? 'Payroll Records' : 'Worker Payroll'}
              </h2>
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                {hasPayrollGenerated ? (
                  filteredPayroll.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-muted-foreground">
                      No matching records
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {filteredPayroll.map((record) => (
                        <PayrollRecordCard
                          key={record.id}
                          record={record}
                          siteNameMap={siteNameMap}
                          isExpanded={expandedWorkers.has(record.id)}
                          onToggle={() => toggleWorkerExpanded(record.id)}
                          onApprove={() => approveMutation.mutate(record.id)}
                          onMarkPaid={() => markPaidMutation.mutate(record.id)}
                          approvePending={approveMutation.isPending}
                          markPaidPending={markPaidMutation.isPending}
                        />
                      ))}
                    </div>
                  )
                ) : (
                  filteredSummaries.length === 0 ? (
                    <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Users className="h-10 w-10" />
                      <p>No attendance marked for this week yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {filteredSummaries.map((emp) => (
                        <WorkerPayrollCard
                          key={emp.employeeId}
                          summary={emp}
                          isExpanded={expandedWorkers.has(emp.employeeId)}
                          onToggle={() => toggleWorkerExpanded(emp.employeeId)}
                          deductionSelections={deductionSelections}
                          onToggleDeduction={toggleDeduction}
                          showPreview={showPreview}
                        />
                      ))}
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </div>

          {/* ========== SECTION 4: PAYROLL SUMMARY ========== */}
          {grandTotals.totalWorkers > 0 && (
            <PayrollSummary
              totalWorkers={grandTotals.totalWorkers}
              totalDays={grandTotals.totalDays}
              totalOtHours={grandTotals.totalOtHours}
              grossPayroll={grandTotals.grossPayroll}
              advanceDeductions={grandTotals.advanceDeductions}
              finalPayroll={grandTotals.finalPayroll}
              siteTotals={siteTotals}
              siteWorkerSummaries={siteWorkerSummaries}
            />
          )}
        </>
      )}
    </div>
  );
}


// =====================================================
// PAYROLL RECORD CARD (saved payroll - collapsible)
// =====================================================

function PayrollRecordCard({
  record,
  siteNameMap,
  isExpanded,
  onToggle,
  onApprove,
  onMarkPaid,
  approvePending,
  markPaidPending,
}: {
  record: WeeklyPayroll;
  siteNameMap: Map<string, string>;
  isExpanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onMarkPaid: () => void;
  approvePending: boolean;
  markPaidPending: boolean;
}) {
  return (
    <div className="transition-colors hover:bg-muted/20">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-medium text-primary">
            {record.employeeName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{record.employeeName}</p>
            <div className="flex items-center gap-2">
              <span className={cn(
                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                roleBadgeColors[record.employeeRole || 'helper']
              )}>
                {record.employeeRole || 'Employee'}
              </span>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                statusConfig[record.status].color
              )}>
                {statusConfig[record.status].icon}
                {statusConfig[record.status].label}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              {record.daysWorked} days
              {record.overtimeHours > 0 ? ` + ${record.overtimeHours.toFixed(1)}h OT` : ''}
            </p>
            {record.totalDeductions > 0 && (
              <p className="text-xs text-red-400">
                -{formatCurrency(record.totalDeductions)} deductions
              </p>
            )}
            <p className="text-lg font-bold text-green-500">
              {formatCurrency(record.netPay)}
            </p>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-border/30 bg-muted/10 px-4 pb-4">
          {/* Site breakdown */}
          {record.siteBreakdowns && record.siteBreakdowns.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Site Breakdown
              </p>
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-left">
                      <th className="p-2.5 font-medium text-muted-foreground">Site</th>
                      <th className="p-2.5 text-center font-medium text-muted-foreground">Days</th>
                      <th className="p-2.5 text-center font-medium text-muted-foreground">OT</th>
                      <th className="p-2.5 text-right font-medium text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.siteBreakdowns.map((sb) => (
                      <tr key={sb.siteId} className="border-t border-border/30">
                        <td className="p-2.5">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {siteNameMap.get(sb.siteId) || sb.siteName || sb.siteId}
                          </div>
                        </td>
                        <td className="p-2.5 text-center">{sb.daysWorked}</td>
                        <td className="p-2.5 text-center">
                          {sb.otHours > 0 ? (
                            <span className="text-orange-500">{sb.otHours.toFixed(1)}h</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-medium">{formatCurrency(sb.totalPay)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30 font-bold">
                      <td className="p-2.5">Total</td>
                      <td className="p-2.5 text-center">{record.daysWorked}</td>
                      <td className="p-2.5 text-center">
                        {record.overtimeHours > 0 ? `${record.overtimeHours.toFixed(1)}h` : '-'}
                      </td>
                      <td className="p-2.5 text-right text-blue-500">
                        {formatCurrency(record.totalEarnings)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Deductions */}
          {record.totalDeductions > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Deductions
              </p>
              <div className="space-y-1.5">
                {record.advances.map((adv) => (
                  <div key={adv.advanceId} className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-400" />
                      <span>Advance: {adv.description}</span>
                    </div>
                    <span className="font-medium text-red-400">-{formatCurrency(adv.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final salary */}
          <div className="mt-3 flex items-center justify-between rounded-lg bg-green-500/10 border-2 border-green-500/30 px-4 py-3">
            <span className="font-semibold">Final Salary</span>
            <span className="text-xl font-bold text-green-500">
              {formatCurrency(record.netPay)}
            </span>
          </div>

          {/* Actions */}
          <div className="mt-3 flex items-center gap-2">
            {record.status === 'draft' && (
              <Button variant="outline" size="sm" className="gap-1" onClick={onApprove} disabled={approvePending}>
                <CheckCircle className="h-3.5 w-3.5" /> Approve
              </Button>
            )}
            {record.status === 'approved' && (
              <Button variant="outline" size="sm" className="gap-1 text-green-500 hover:text-green-400" onClick={onMarkPaid} disabled={markPaidPending}>
                <Wallet className="h-3.5 w-3.5" /> Mark Paid
              </Button>
            )}
            {record.status === 'paid' && (
              <span className="text-xs text-green-500">&#10003; Paid</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

