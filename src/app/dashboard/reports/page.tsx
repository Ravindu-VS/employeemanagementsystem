'use client';

/**
 * =====================================================
 * REPORTS PAGE
 * =====================================================
 * Generate and view various reports with real data.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Calendar,
  Users,
  DollarSign,
  Clock,
  Building2,
  TrendingUp,
  BarChart3,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  getPendingAdvances,
  loadPayrollInputs,
} from '@/services';
import { ACCESS_MATRIX } from '@/domain/roles';
import { useRequireRole } from '@/components/providers/auth-provider';
import { formatCurrency, cn } from '@/lib/utils';
import { computePayroll, DRIVER_DUTY_LINE_ID, type PayrollEngineResult } from '@/domain/payroll';
import { PayrollOverview, SiteTotalsTable, GrandTotalCard } from '@/components/payroll/PayrollSummary';
import { RoleBadge } from '@/components/payroll/RoleBadge';
import {
  formatDate,
  getWeekNumber,
  getPayrollWeek,
  todayISO,
  addDaysISO,
} from '@/lib/date-utils';
import type { UserProfile } from '@/types';

// Report types
const reportTypes = [
  {
    id: 'attendance-summary',
    title: 'Attendance Summary',
    description: 'Daily/weekly attendance overview for all employees',
    icon: Clock,
    color: 'bg-blue-500/20 text-blue-400',
  },
  {
    id: 'payroll-summary',
    title: 'Payroll Summary',
    description: 'Salary calculation based on attendance data',
    icon: DollarSign,
    color: 'bg-green-500/20 text-green-400',
  },
  {
    id: 'employee-report',
    title: 'Employee Report',
    description: 'Complete employee list with roles and rates',
    icon: Users,
    color: 'bg-purple-500/20 text-purple-400',
  },
  {
    id: 'site-report',
    title: 'Site Report',
    description: 'Work site attendance and manpower allocation',
    icon: Building2,
    color: 'bg-orange-500/20 text-orange-400',
  },
  {
    id: 'overtime-report',
    title: 'Overtime Report',
    description: 'OT hours and payments by employee',
    icon: TrendingUp,
    color: 'bg-yellow-500/20 text-yellow-400',
  },
  {
    id: 'financial-summary',
    title: 'Financial Summary',
    description: 'Advances, loans, and deductions overview',
    icon: BarChart3,
    color: 'bg-cyan-500/20 text-cyan-400',
  },
];

export default function ReportsPage() {
  const { isAuthorized } = useRequireRole(ACCESS_MATRIX.reports);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'custom'>('week');
  const [customDates, setCustomDates] = useState(() => getPayrollWeek(todayISO()));
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const today = todayISO();
    if (dateRange === 'week') {
      const w = getPayrollWeek(today);
      return { startDate: w.start, endDate: w.end };
    } else if (dateRange === 'month') {
      const first = `${today.slice(0, 7)}-01`;
      const nextMonthFirst = addDaysISO(`${today.slice(0, 7)}-28`, 4).slice(0, 7) + '-01';
      return { startDate: first, endDate: addDaysISO(nextMonthFirst, -1) };
    }
    return { startDate: customDates.start, endDate: customDates.end };
  }, [dateRange, customDates]);

  // Same inputs and the same engine as the Payroll page → identical figures.
  const { data: inputs, isLoading: loadingAttendance } = useQuery({
    queryKey: ['report-inputs', startDate, endDate],
    queryFn: () => loadPayrollInputs({ start: startDate, end: endDate }),
    enabled: !!startDate && !!endDate && startDate <= endDate,
  });

  const { data: pendingAdvances = [] } = useQuery({
    queryKey: ['pendingAdvances'],
    queryFn: getPendingAdvances,
  });

  // A payroll week uses the administrator's advance ticks from the Payroll page.
  const isPayrollWeek = getPayrollWeek(startDate).start === startDate && getPayrollWeek(startDate).end === endDate;
  const payroll = useMemo<PayrollEngineResult | null>(() => {
    if (!inputs) return null;
    let advanceSelections: Record<string, boolean> = {};
    if (isPayrollWeek) {
      try { advanceSelections = JSON.parse(window.localStorage.getItem(`payroll-advance-selections-${startDate}`) || '{}'); } catch { /* none */ }
    }
    return computePayroll({ ...inputs, advanceSelections, includeDeductions: isPayrollWeek });
  }, [inputs, isPayrollWeek, startDate]);

  const employees = inputs?.employees || [];
  const sites = inputs?.sites || [];
  const activeLoans = inputs?.loans || [];
  const activeEmployees = employees.filter(e => e.isActive).length;
  const weekNumber = getWeekNumber(new Date());

  const handleGenerateReport = (reportId: string) => {
    setSelectedReport(reportId);
    setGeneratedReport(reportId);
  };

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">
            Generate and view various reports
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
        <Card className="bg-card/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/20 p-2">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Employees</p>
                <p className="text-xl sm:text-2xl font-bold">{activeEmployees}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/20 p-2">
                <Building2 className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Sites</p>
                <p className="text-xl sm:text-2xl font-bold">{sites.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/20 p-2">
                <Calendar className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Week</p>
                <p className="text-xl sm:text-2xl font-bold">Week {weekNumber}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/20 p-2">
                <FileText className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gross payroll (period)</p>
                <p className="text-xl sm:text-2xl font-bold">{formatCurrency(payroll?.totals.gross || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Range Selector */}
      <Card className="bg-card/50">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between md:justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Date Range:</span>
              <div className="flex rounded-md border border-border">
                <button
                  onClick={() => setDateRange('week')}
                  className={cn(
                    'px-3 py-1.5 text-sm transition-colors',
                    dateRange === 'week' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted'
                  )}
                >
                  This Week
                </button>
                <button
                  onClick={() => setDateRange('month')}
                  className={cn(
                    'border-x border-border px-3 py-1.5 text-sm transition-colors',
                    dateRange === 'month' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted'
                  )}
                >
                  This Month
                </button>
                <button
                  onClick={() => setDateRange('custom')}
                  className={cn(
                    'px-3 py-1.5 text-sm transition-colors',
                    dateRange === 'custom' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted'
                  )}
                >
                  Custom
                </button>
              </div>
            </div>

            {dateRange === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customDates.start}
                  onChange={(e) => setCustomDates(prev => ({ ...prev, start: e.target.value }))}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="date"
                  value={customDates.end}
                  onChange={(e) => setCustomDates(prev => ({ ...prev, end: e.target.value }))}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                />
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              {startDate} to {endDate}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Report Types Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportTypes.map((report) => {
          const Icon = report.icon;
          const isSelected = generatedReport === report.id;
          
          return (
            <Card 
              key={report.id} 
              className={cn(
                'bg-card/50 cursor-pointer transition-all hover:bg-card/80',
                isSelected && 'ring-2 ring-primary'
              )}
              onClick={() => handleGenerateReport(report.id)}
            >
              <CardContent className="p-5">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className={cn('rounded-lg p-2', report.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {isSelected && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">
                        Active
                      </span>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-foreground">{report.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {report.description}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateReport(report.id);
                    }}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    Generate
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Report Display Area */}
      {generatedReport && (
        <ReportDisplay
          reportId={generatedReport}
          employees={employees}
          payroll={payroll}
          pendingAdvances={pendingAdvances}
          activeLoans={activeLoans}
          startDate={startDate}
          endDate={endDate}
          loading={loadingAttendance}
          onClose={() => setGeneratedReport(null)}
        />
      )}
    </div>
  );
}

// =====================================================
// REPORT DISPLAY COMPONENT
// =====================================================

interface ReportDisplayProps {
  reportId: string;
  employees: UserProfile[];
  payroll: PayrollEngineResult | null;
  pendingAdvances: any[];
  activeLoans: any[];
  startDate: string;
  endDate: string;
  loading: boolean;
  onClose: () => void;
}

function ReportDisplay({
  reportId,
  employees,
  payroll,
  pendingAdvances,
  activeLoans,
  startDate,
  endDate,
  loading,
  onClose,
}: ReportDisplayProps) {
  const reportType = reportTypes.find(r => r.id === reportId);

  if (loading || !payroll) {
    return (
      <Card className="bg-card/50">
        <CardContent className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Generating report...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{reportType?.title}</CardTitle>
            <CardDescription>
              Period: {formatDate(startDate, 'EEE dd/MM/yyyy')} to {formatDate(endDate, 'EEE dd/MM/yyyy')}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {reportId === 'attendance-summary' && <AttendanceSummaryReport payroll={payroll} />}
        {reportId === 'payroll-summary' && <PayrollSummaryReport payroll={payroll} />}
        {reportId === 'employee-report' && (
          <EmployeeReport employees={employees} />
        )}
        {reportId === 'site-report' && <SiteReport payroll={payroll} />}
        {reportId === 'overtime-report' && <OvertimeReport payroll={payroll} />}
        {reportId === 'financial-summary' && (
          <FinancialSummaryReport
            employees={employees}
            pendingAdvances={pendingAdvances}
            activeLoans={activeLoans}
          />
        )}
      </CardContent>
    </Card>
  );
}

// =====================================================
// REPORTS — all read the PayrollEngineResult (one source of truth)
// =====================================================

const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function Empty() {
  return <div className="flex h-40 items-center justify-center text-muted-foreground">No attendance records found for this period</div>;
}

function AttendanceSummaryReport({ payroll }: { payroll: PayrollEngineResult }) {
  if (payroll.employees.length === 0) return <Empty />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Employees" value={String(payroll.totals.employees)} />
        <Stat label="Days (labor + driver)" value={fmtNum(payroll.totals.days)} />
        <Stat label="Supervisor site visits" value={String(payroll.totals.visits)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-3 font-medium">Employee</th>
              <th className="p-3 font-medium">Role</th>
              <th className="p-3 text-right font-medium">Days</th>
              <th className="p-3 text-right font-medium">Visits</th>
              <th className="p-3 text-right font-medium">OT h</th>
              <th className="p-3 font-medium">Sites</th>
            </tr>
          </thead>
          <tbody>
            {payroll.employees.map((e) => (
              <tr key={e.employeeId} className="border-b border-border/50">
                <td className="p-3 font-medium">{e.employeeName}</td>
                <td className="p-3"><RoleBadge role={e.role} /></td>
                <td className="p-3 text-right">{fmtNum(e.daysWorked)}</td>
                <td className="p-3 text-right">{e.visits}</td>
                <td className="p-3 text-right">{fmtNum(e.otHours)}</td>
                <td className="p-3 text-muted-foreground">{e.sites.map((l) => l.siteName).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AnomalyList payroll={payroll} />
    </div>
  );
}

function PayrollSummaryReport({ payroll }: { payroll: PayrollEngineResult }) {
  if (payroll.employees.length === 0) return <Empty />;
  return (
    <div className="space-y-4">
      <PayrollOverview totals={payroll.totals} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-2 font-medium">Employee</th>
              <th className="p-2 font-medium">Site</th>
              <th className="p-2 text-right font-medium">Days / visits</th>
              <th className="p-2 text-right font-medium">OT h</th>
              <th className="p-2 text-right font-medium">Normal</th>
              <th className="p-2 text-right font-medium">OT pay</th>
              <th className="p-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {payroll.employees.map((e) => (
              <PayrollRows key={e.employeeId} e={e} />
            ))}
          </tbody>
        </table>
      </div>
      <GrandTotalCard totals={payroll.totals} />
    </div>
  );
}

function PayrollRows({ e }: { e: PayrollEngineResult['employees'][number] }) {
  return (
    <>
      {e.sites.map((l, i) => (
        <tr key={l.siteId} className="border-b border-border/40">
          <td className="p-2 font-medium">{i === 0 ? e.employeeName : ''}</td>
          <td className="p-2">{l.siteName}</td>
          <td className="p-2 text-right">{l.payModel === 'site_visit' ? `${l.visits} visits` : fmtNum(l.days)}</td>
          <td className="p-2 text-right">{fmtNum(l.otHours)}</td>
          <td className="p-2 text-right">{formatCurrency(l.normalPay)}</td>
          <td className="p-2 text-right">{formatCurrency(l.otPay)}</td>
          <td className="p-2 text-right">{formatCurrency(l.total)}</td>
        </tr>
      ))}
      <tr className="border-b border-border bg-muted/30 text-xs sm:text-sm">
        <td className="p-2" colSpan={4}>
          {e.employeeName}: gross {formatCurrency(e.gross)} (transport {formatCurrency(e.transport)})
          {e.totalDeductions > 0 && <> − advances {formatCurrency(e.advanceDeduction)} − loans {formatCurrency(e.loanDeduction)}</>}
        </td>
        <td className="p-2 text-right font-semibold" colSpan={3}>Final {formatCurrency(e.finalSalary)}</td>
      </tr>
    </>
  );
}

function SiteReport({ payroll }: { payroll: PayrollEngineResult }) {
  if (payroll.sites.length === 0) return <Empty />;
  return (
    <div className="space-y-4">
      <SiteTotalsTable sites={payroll.sites} />
      {payroll.sites.map((site) => (
        <div key={site.siteId}>
          <h3 className="mb-2 font-semibold">{site.siteName}</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-2 font-medium">Employee</th>
                  <th className="p-2 text-right font-medium">Days / visits</th>
                  <th className="p-2 text-right font-medium">OT h</th>
                  <th className="p-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {payroll.employees.flatMap((e) =>
                  e.sites.filter((l) => l.siteId === site.siteId).map((l) => (
                    <tr key={e.employeeId} className="border-b border-border/40">
                      <td className="p-2">{e.employeeName}</td>
                      <td className="p-2 text-right">{l.payModel === 'site_visit' ? `${l.visits} visits` : fmtNum(l.days)}</td>
                      <td className="p-2 text-right">{fmtNum(l.otHours)}</td>
                      <td className="p-2 text-right">{formatCurrency(l.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function OvertimeReport({ payroll }: { payroll: PayrollEngineResult }) {
  const rows = payroll.employees.flatMap((e) =>
    e.sites.filter((l) => l.otHours > 0).map((l) => ({ e, l }))
  );
  if (rows.length === 0) return <div className="flex h-40 items-center justify-center text-muted-foreground">No overtime recorded in this period</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="OT hours" value={fmtNum(payroll.totals.otHours)} />
        <Stat label="OT pay" value={formatCurrency(payroll.totals.otPay)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-2 font-medium">Employee</th>
              <th className="p-2 font-medium">Site / duty</th>
              <th className="p-2 text-right font-medium">OT h</th>
              <th className="p-2 text-right font-medium">Rate (daily ÷ 8)</th>
              <th className="p-2 text-right font-medium">OT pay</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, l }) => (
              <tr key={`${e.employeeId}-${l.siteId}`} className="border-b border-border/40">
                <td className="p-2">{e.employeeName}</td>
                <td className="p-2">{l.siteId === DRIVER_DUTY_LINE_ID ? 'Driver duty' : l.siteName}</td>
                <td className="p-2 text-right">{fmtNum(l.otHours)}</td>
                <td className="p-2 text-right">{formatCurrency(e.otRate)}</td>
                <td className="p-2 text-right">{formatCurrency(l.otPay)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnomalyList({ payroll }: { payroll: PayrollEngineResult }) {
  if (payroll.anomalies.length === 0) return null;
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
      <p className="mb-1 font-semibold">Data-quality notes (review — nothing was changed automatically)</p>
      <ul className="list-inside list-disc space-y-0.5">
        {payroll.anomalies.map((a, i) => <li key={i}>{a.employeeName}: {a.message}</li>)}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <p className="text-xl font-bold text-foreground sm:text-2xl">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

// =====================================================
// EMPLOYEE REPORT
// =====================================================

function EmployeeReport({ employees }: { employees: UserProfile[] }) {
  const activeEmployees = employees.filter(e => e.isActive);
  const inactiveEmployees = employees.filter(e => !e.isActive);

  const roleGroups = useMemo(() => {
    const groups: Record<string, UserProfile[]> = {};
    employees.forEach(emp => {
      const role = emp.role || 'helper';
      if (!groups[role]) groups[role] = [];
      groups[role].push(emp);
    });
    return groups;
  }, [employees]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 sm:p-4">
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-blue-500">{employees.length}</p>
          <p className="text-sm text-muted-foreground">Total Employees</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-green-500">{activeEmployees.length}</p>
          <p className="text-sm text-muted-foreground">Active</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-red-500">{inactiveEmployees.length}</p>
          <p className="text-sm text-muted-foreground">Inactive</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {Object.entries(roleGroups).map(([role, emps]) => (
          <div key={role} className="rounded-lg border border-border/50 p-2 text-center">
            <p className="text-lg font-bold">{emps.length}</p>
            <p className="text-xs text-muted-foreground capitalize">{role}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-3 font-medium text-muted-foreground">Name</th>
              <th className="p-3 font-medium text-muted-foreground">Worker ID</th>
              <th className="p-3 font-medium text-muted-foreground">Role</th>
              <th className="p-3 font-medium text-muted-foreground">Phone</th>
              <th className="p-3 font-medium text-muted-foreground text-right">Daily Rate</th>
              <th className="p-3 font-medium text-muted-foreground text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.uid} className="border-b border-border/50">
                <td className="p-3 font-medium">{emp.displayName || 'Unnamed'}</td>
                <td className="p-3 text-muted-foreground">{emp.workerId || '-'}</td>
                <td className="p-3 capitalize">{emp.role}</td>
                <td className="p-3 text-muted-foreground">{emp.phone || '-'}</td>
                <td className="p-3 text-right">{formatCurrency(emp.dailyRate || 0)}</td>
                <td className="p-3 text-center">
                  {emp.isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                      <CheckCircle className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                      <XCircle className="h-3 w-3" /> Inactive
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =====================================================
// FINANCIAL SUMMARY REPORT
// =====================================================

function FinancialSummaryReport({
  employees,
  pendingAdvances,
  activeLoans,
}: {
  employees: UserProfile[];
  pendingAdvances: any[];
  activeLoans: any[];
}) {
  const totalPendingAdvances = pendingAdvances.reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
  const totalActiveLoanBalance = activeLoans.reduce((sum: number, l: any) => sum + (l.remainingAmount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-yellow-500">{pendingAdvances.length}</p>
          <p className="text-sm text-muted-foreground">Pending Advances</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-orange-500">{formatCurrency(totalPendingAdvances)}</p>
          <p className="text-sm text-muted-foreground">Advance Amount</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-blue-500">{activeLoans.length}</p>
          <p className="text-sm text-muted-foreground">Active Loans</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-red-500">{formatCurrency(totalActiveLoanBalance)}</p>
          <p className="text-sm text-muted-foreground">Outstanding Loan Balance</p>
        </div>
      </div>

      {pendingAdvances.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold">Pending Advance Requests</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-3 font-medium text-muted-foreground">Employee</th>
                  <th className="p-3 font-medium text-muted-foreground text-right">Amount</th>
                  <th className="p-3 font-medium text-muted-foreground">Reason</th>
                  <th className="p-3 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {pendingAdvances.map((adv: any) => (
                  <tr key={adv.id} className="border-b border-border/50">
                    <td className="p-3 font-medium">{adv.employeeName || adv.employeeId}</td>
                    <td className="p-3 text-right">{formatCurrency(adv.amount)}</td>
                    <td className="p-3 text-muted-foreground">{adv.reason || '-'}</td>
                    <td className="p-3 text-muted-foreground">
                      {adv.createdAt ? formatDate(adv.createdAt) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeLoans.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold">Active Loans</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-3 font-medium text-muted-foreground">Employee</th>
                  <th className="p-3 font-medium text-muted-foreground text-right">Principal</th>
                  <th className="p-3 font-medium text-muted-foreground text-right">Remaining</th>
                  <th className="p-3 font-medium text-muted-foreground text-right">EMI</th>
                  <th className="p-3 font-medium text-muted-foreground text-center">Progress</th>
                </tr>
              </thead>
              <tbody>
                {activeLoans.map((loan: any) => (
                  <tr key={loan.id} className="border-b border-border/50">
                    <td className="p-3 font-medium">{loan.employeeName || loan.employeeId}</td>
                    <td className="p-3 text-right">{formatCurrency(loan.principalAmount)}</td>
                    <td className="p-3 text-right text-orange-400">{formatCurrency(loan.remainingAmount)}</td>
                    <td className="p-3 text-right">{formatCurrency(loan.emiAmount)}</td>
                    <td className="p-3 text-center">
                      {loan.paidEmis}/{loan.totalEmis} EMIs
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pendingAdvances.length === 0 && activeLoans.length === 0 && (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          No pending advances or active loans
        </div>
      )}
    </div>
  );
}