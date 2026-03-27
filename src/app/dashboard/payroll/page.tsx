'use client';

/**
 * =====================================================
 * PAYROLL PAGE — Redesigned
 * =====================================================
 * Section 1: Week Selector + Generate/Preview
 * Section 2: Site Summary Cards
 * Section 3: Worker Payroll Cards (collapsible)
 * Section 4: Payroll Summary
 *
 * All data from real Firebase queries — zero mocks.
 */

import { useState, useMemo, useCallback } from 'react';
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
import {
  formatDate,
  getWeekNumber,
  getWeekStart,
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
  advances: AdvanceRequest[];
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

  // Week boundaries (Monday start)
  const weekStart = getWeekStart(selectedDate);
  const weekNumber = getWeekNumber(selectedDate);
  const saturday = new Date(weekStart);
  saturday.setDate(weekStart.getDate() + 5);

  const weekStartStr = toISODateString(weekStart);
  const saturdayStr = toISODateString(saturday);

  // ---- DATA QUERIES (all real Firebase data) ----

  const { data: weekAttendance = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ['week-attendance', weekStartStr, saturdayStr],
    queryFn: () => getSimpleAttendanceForDateRange(weekStartStr, saturdayStr),
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

  // Fetch ALL pending advances in one query — grouped by worker in memory
  const { data: pendingAdvances = [] } = useQuery({
    queryKey: ['pending-advances'],
    queryFn: getAllPendingAdvances,
  });

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
    const map = new Map<string, AdvanceRequest[]>();
    pendingAdvances.forEach(adv => {
      const list = map.get(adv.employeeId) || [];
      list.push(adv);
      map.set(adv.employeeId, list);
    });
    return map;
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

  // ---- COMPUTE EMPLOYEE SUMMARIES (useMemo) ----

  const employeeSummaries = useMemo((): EmployeeWeekSummary[] => {
    const workerSiteMap = new Map<string, Map<string, { daysWorked: number; otHours: number }>>();

    for (const record of weekAttendance) {
      const emp = employeeMap.get(record.workerId);
      if (!emp) continue;

      const hasMorning = !!record.morningSite;
      const hasEvening = !!record.eveningSite;
      if (!hasMorning && !hasEvening) continue;

      if (!workerSiteMap.has(record.workerId)) {
        workerSiteMap.set(record.workerId, new Map());
      }
      const siteMap = workerSiteMap.get(record.workerId)!;

      if (hasMorning) {
        const site = siteMap.get(record.morningSite!) || { daysWorked: 0, otHours: 0 };
        site.daysWorked += 0.5;
        siteMap.set(record.morningSite!, site);
      }
      if (hasEvening) {
        const site = siteMap.get(record.eveningSite!) || { daysWorked: 0, otHours: 0 };
        site.daysWorked += 0.5;
        siteMap.set(record.eveningSite!, site);
      }
      const otHours = record.otHours || 0;
      if (otHours > 0) {
        const otSiteId = record.eveningSite || record.morningSite;
        if (otSiteId) {
          const site = siteMap.get(otSiteId) || { daysWorked: 0, otHours: 0 };
          site.otHours += otHours;
          siteMap.set(otSiteId, site);
        }
      }
    }

    const summaries: EmployeeWeekSummary[] = [];
    for (const [workerId, siteMap] of workerSiteMap) {
      const emp = employeeMap.get(workerId);
      if (!emp) continue;

      const dailyRate = emp.dailyRate || 0;
      const otRate = emp.otRate || 0;

      const siteBreakdowns: SiteBreakdown[] = Array.from(siteMap.entries()).map(
        ([siteId, data]) => ({
          siteId,
          siteName: siteNameMap.get(siteId) || siteId,
          daysWorked: data.daysWorked,
          otHours: data.otHours,
          regularPay: data.daysWorked * dailyRate,
          otPay: data.otHours * otRate,
          totalPay: data.daysWorked * dailyRate + data.otHours * otRate,
        })
      );

      const empAdvances = advancesByEmployee.get(emp.uid) || [];

      summaries.push({
        employeeId: emp.uid,
        employeeName: emp.displayName || emp.email,
        employeeRole: emp.role,
        daysWorked: siteBreakdowns.reduce((s, b) => s + b.daysWorked, 0),
        otHours: siteBreakdowns.reduce((s, b) => s + b.otHours, 0),
        grossPay: siteBreakdowns.reduce((s, b) => s + b.totalPay, 0),
        dailyRate,
        otRate,
        siteBreakdowns,
        advances: empAdvances,
      });
    }

    return summaries.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [weekAttendance, employeeMap, siteNameMap, advancesByEmployee]);

  // ---- SITE TOTALS (useMemo) ----

  const siteTotals = useMemo((): (SitePayrollTotal & { totalDays: number; totalOtHours: number })[] => {
    const totalsMap = new Map<string, SitePayrollTotal & { totalDays: number; totalOtHours: number }>();

    for (const emp of employeeSummaries) {
      for (const sb of emp.siteBreakdowns) {
        const existing = totalsMap.get(sb.siteId) || {
          siteId: sb.siteId,
          siteName: sb.siteName,
          totalPayroll: 0,
          workerCount: 0,
          totalDays: 0,
          totalOtHours: 0,
        };
        existing.totalPayroll += sb.totalPay;
        existing.workerCount += 1;
        existing.totalDays += sb.daysWorked;
        existing.totalOtHours += sb.otHours;
        totalsMap.set(sb.siteId, existing);
      }
    }

    return Array.from(totalsMap.values()).sort((a, b) => b.totalPayroll - a.totalPayroll);
  }, [employeeSummaries]);

  // ---- GRAND TOTALS (useMemo) ----

  const grandTotals = useMemo(() => {
    const totalWorkers = employeeSummaries.length;
    const totalDays = employeeSummaries.reduce((s, e) => s + e.daysWorked, 0);
    const totalOtHours = employeeSummaries.reduce((s, e) => s + e.otHours, 0);
    const grossPayroll = employeeSummaries.reduce((s, e) => s + e.grossPay, 0);

    // Calculate advance deductions based on CEO checkbox selections
    let advanceDeductions = 0;
    for (const emp of employeeSummaries) {
      for (const adv of emp.advances) {
        if (deductionSelections[adv.id]) {
          advanceDeductions += adv.amount;
        }
      }
    }

    return {
      totalWorkers,
      totalDays,
      totalOtHours,
      grossPayroll,
      advanceDeductions,
      finalPayroll: grossPayroll - advanceDeductions,
    };
  }, [employeeSummaries, deductionSelections]);

  // ---- FILTER ----

  const filteredSummaries = employeeSummaries.filter(s =>
    !searchQuery || s.employeeName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredPayroll = payrollRecords.filter(r =>
    !searchQuery || r.employeeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ---- MUTATIONS ----

  const generateMutation = useMutation({
    mutationFn: () => generateWeeklyPayroll(weekStart, user?.uid || ''),
    onSuccess: (data) => {
      toast({
        title: 'Payroll Generated',
        description: `Generated payroll for ${data.success} employees.${data.failed > 0 ? ` ${data.failed} failed.` : ''}`,
      });
      setShowPreview(false);
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payroll</h1>
          <p className="text-muted-foreground">
            Weekly salary tracking &mdash; Pay day every Saturday
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Week {weekNumber}</span>
            <span className="text-sm text-muted-foreground">
              ({formatDate(weekStart)} - {formatDate(saturday)})
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Status + Actions Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium',
                hasPayrollGenerated
                  ? 'border-green-500/30 bg-green-500/10 text-green-500'
                  : 'border-blue-500/30 bg-blue-500/10 text-blue-500'
              )}>
                {hasPayrollGenerated ? (
                  <><CheckCircle className="h-4 w-4" /> Payroll Generated</>
                ) : (
                  <><Clock className="h-4 w-4" /> Live Preview</>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {grandTotals.totalWorkers} workers &middot; {formatCurrency(grandTotals.grossPayroll)} gross
              </span>
            </div>

            {!hasPayrollGenerated && (
              <div className="flex items-center gap-2">
                {!showPreview ? (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setShowPreview(true)}
                    disabled={employeeSummaries.length === 0}
                  >
                    <Eye className="h-4 w-4" />
                    Preview Payroll
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowPreview(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="gap-2"
                      onClick={() => generateMutation.mutate()}
                      disabled={generateMutation.isPending}
                    >
                      {generateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      Approve &amp; Generate Payroll
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
              <h2 className="mb-3 text-lg font-semibold text-foreground">Site Summary</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {siteTotals.map((st) => (
                  <Card key={st.siteId}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-foreground">{st.siteName}</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Workers</p>
                          <p className="text-lg font-bold">{st.workerCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Days</p>
                          <p className="text-lg font-bold">{st.totalDays}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">OT Hours</p>
                          <p className="text-lg font-bold text-orange-500">
                            {st.totalOtHours > 0 ? `${st.totalOtHours.toFixed(1)}h` : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Salary</p>
                          <p className="text-lg font-bold text-green-500">{formatCurrency(st.totalPayroll)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* ========== SECTION 3: WORKER PAYROLL CARDS ========== */}
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">
                {hasPayrollGenerated ? 'Payroll Records' : 'Worker Payroll'}
              </h2>
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search workers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
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
                        <LiveWorkerCard
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Payroll Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold">{grandTotals.totalWorkers}</p>
                    <p className="text-sm text-muted-foreground">Workers</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold">{grandTotals.totalDays}</p>
                    <p className="text-sm text-muted-foreground">Total Days</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-orange-500">{grandTotals.totalOtHours.toFixed(1)}h</p>
                    <p className="text-sm text-muted-foreground">Total OT</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-blue-500">{formatCurrency(grandTotals.grossPayroll)}</p>
                    <p className="text-sm text-muted-foreground">Gross Payroll</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-2xl font-bold text-red-400">{formatCurrency(grandTotals.advanceDeductions)}</p>
                    <p className="text-sm text-muted-foreground">Advance Deductions</p>
                  </div>
                  <div className="rounded-lg border-2 border-green-500/30 bg-green-500/5 p-3 text-center">
                    <p className="text-2xl font-bold text-green-500">{formatCurrency(grandTotals.finalPayroll)}</p>
                    <p className="text-sm text-muted-foreground">Final Payroll</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// =====================================================
// LIVE WORKER CARD — Collapsible
// Collapsed: name, role, grand total
// Expanded: site breakdown + advances + final salary
// =====================================================

function LiveWorkerCard({
  summary,
  isExpanded,
  onToggle,
  deductionSelections,
  onToggleDeduction,
  showPreview,
}: {
  summary: EmployeeWeekSummary;
  isExpanded: boolean;
  onToggle: () => void;
  deductionSelections: Record<string, boolean>;
  onToggleDeduction: (advanceId: string) => void;
  showPreview: boolean;
}) {
  // Calculate advance deduction for this worker based on checkbox state
  const advanceDeduction = summary.advances.reduce(
    (sum, adv) => sum + (deductionSelections[adv.id] ? adv.amount : 0),
    0
  );
  const finalSalary = summary.grossPay - advanceDeduction;

  return (
    <div className="transition-colors hover:bg-muted/20">
      {/* Collapsed header — click to expand */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-medium text-primary">
            {summary.employeeName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{summary.employeeName}</p>
            <div className="flex items-center gap-2">
              <span className={cn(
                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                roleBadgeColors[summary.employeeRole]
              )}>
                {summary.employeeRole}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatCurrency(summary.dailyRate)}/day
              </span>
              {summary.siteBreakdowns.length > 1 && (
                <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-400">
                  {summary.siteBreakdowns.length} sites
                </span>
              )}
              {summary.advances.length > 0 && (
                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400">
                  Advance
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              {summary.daysWorked} days{summary.otHours > 0 ? ` + ${summary.otHours.toFixed(1)}h OT` : ''}
            </p>
            {advanceDeduction > 0 && (
              <p className="text-xs text-red-400">-{formatCurrency(advanceDeduction)} advance</p>
            )}
            <p className="text-lg font-bold text-green-500">
              {formatCurrency(finalSalary)}
            </p>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-border/30 bg-muted/10 px-4 pb-4">

          {/* Site breakdown */}
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
                  {summary.siteBreakdowns.map((sb) => (
                    <tr key={sb.siteId} className="border-t border-border/30">
                      <td className="p-2.5">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {sb.siteName}
                        </div>
                      </td>
                      <td className="p-2.5 text-center">{sb.daysWorked}</td>
                      <td className="p-2.5 text-center">
                        {sb.otHours > 0 ? (
                          <span className="text-orange-500">{sb.otHours.toFixed(1)}h</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-medium">{formatCurrency(sb.totalPay)}</td>
                    </tr>
                  ))}
                </tbody>
                {summary.siteBreakdowns.length > 1 && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30 font-bold">
                      <td className="p-2.5">Total</td>
                      <td className="p-2.5 text-center">{summary.daysWorked}</td>
                      <td className="p-2.5 text-center">
                        {summary.otHours > 0 ? `${summary.otHours.toFixed(1)}h` : '—'}
                      </td>
                      <td className="p-2.5 text-right text-blue-500">
                        {formatCurrency(summary.grossPay)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Gross salary */}
          <div className="mt-3 flex items-center justify-between rounded-lg bg-blue-500/5 border border-blue-500/20 px-4 py-2">
            <span className="text-sm font-medium">Gross Salary</span>
            <span className="font-bold text-blue-500">{formatCurrency(summary.grossPay)}</span>
          </div>

          {/* Advances section */}
          {summary.advances.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Advances
              </p>
              <div className="space-y-2">
                {summary.advances.map((adv) => (
                  <div
                    key={adv.id}
                    className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <AlertCircle className="h-4 w-4 text-red-400" />
                          <span className="font-medium text-red-400">
                            {formatCurrency(adv.amount)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground ml-6">
                          {adv.requestedAt
                            ? formatDate(adv.requestedAt instanceof Date ? adv.requestedAt : new Date(adv.requestedAt))
                            : '—'}
                          {adv.reason ? ` — ${adv.reason}` : ''}
                        </p>
                      </div>

                      {/* Deduct checkbox — CEO control */}
                      {(showPreview || !showPreview) && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={deductionSelections[adv.id] || false}
                            onChange={(e) => {
                              e.stopPropagation();
                              onToggleDeduction(adv.id);
                            }}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <span className="text-xs font-medium whitespace-nowrap">
                            Deduct This Week
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final salary — highlighted */}
          <div className="mt-3 flex items-center justify-between rounded-lg bg-green-500/10 border-2 border-green-500/30 px-4 py-3">
            <span className="font-semibold">Final Salary</span>
            <div className="text-right">
              {advanceDeduction > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(summary.grossPay)} - {formatCurrency(advanceDeduction)}
                </p>
              )}
              <span className="text-xl font-bold text-green-500">
                {formatCurrency(finalSalary)}
              </span>
            </div>
          </div>

          {advanceDeduction === 0 && summary.advances.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground italic">
              Advance will carry forward to next week
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================
// PAYROLL RECORD CARD (saved payroll — collapsible)
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
                            <span className="text-muted-foreground">—</span>
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
                        {record.overtimeHours > 0 ? `${record.overtimeHours.toFixed(1)}h` : '—'}
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
