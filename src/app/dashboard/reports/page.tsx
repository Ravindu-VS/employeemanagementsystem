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
  getAllEmployees,
  getActiveSites,
  getSimpleAttendanceForDateRange,
  getPendingAdvances,
  getActiveLoans,
} from '@/services';
import { useRequireRole } from '@/components/providers/auth-provider';
import { formatCurrency, cn } from '@/lib/utils';
import { calculateOtHourlyRate } from '@/lib/salary-utils';
import {
  formatDate,
  getWeekNumber,
  toISODateString,
} from '@/lib/date-utils';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import type { UserProfile, SimpleAttendance, WorkSite } from '@/types';

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
  const { isAuthorized } = useRequireRole(['owner', 'ceo', 'manager']);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'custom'>('week');
  const [customDates, setCustomDates] = useState({
    start: toISODateString(startOfWeek(new Date(), { weekStartsOn: 1 })),
    end: toISODateString(endOfWeek(new Date(), { weekStartsOn: 1 })),
  });
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (dateRange === 'week') {
      return {
        startDate: toISODateString(startOfWeek(now, { weekStartsOn: 1 })),
        endDate: toISODateString(endOfWeek(now, { weekStartsOn: 1 })),
      };
    } else if (dateRange === 'month') {
      return {
        startDate: toISODateString(startOfMonth(now)),
        endDate: toISODateString(endOfMonth(now)),
      };
    }
    return { startDate: customDates.start, endDate: customDates.end };
  }, [dateRange, customDates]);

  // Fetch all data
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: getAllEmployees,
  });

  const { data: sites = [] } = useQuery({
    queryKey: ['active-sites'],
    queryFn: getActiveSites,
  });

  const { data: attendance = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ['attendance-range', startDate, endDate],
    queryFn: () => getSimpleAttendanceForDateRange(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });

  const { data: pendingAdvances = [] } = useQuery({
    queryKey: ['pendingAdvances'],
    queryFn: getPendingAdvances,
  });

  const { data: activeLoans = [] } = useQuery({
    queryKey: ['activeLoans'],
    queryFn: getActiveLoans,
  });

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
                <p className="text-sm text-muted-foreground">Attendance Records</p>
                <p className="text-xl sm:text-2xl font-bold">{attendance.length}</p>
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
          sites={sites}
          attendance={attendance}
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
  sites: any[];
  attendance: SimpleAttendance[];
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
  sites,
  attendance,
  pendingAdvances,
  activeLoans,
  startDate,
  endDate,
  loading,
  onClose,
}: ReportDisplayProps) {
  const reportType = reportTypes.find(r => r.id === reportId);

  if (loading) {
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
              Period: {startDate} to {endDate}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {reportId === 'attendance-summary' && (
          <AttendanceSummaryReport
            employees={employees}
            attendance={attendance}
            sites={sites}
          />
        )}
        {reportId === 'payroll-summary' && (
          <PayrollSummaryReport
            employees={employees}
            attendance={attendance}
            sites={sites}
          />
        )}
        {reportId === 'employee-report' && (
          <EmployeeReport employees={employees} />
        )}
        {reportId === 'site-report' && (
          <SiteReport
            sites={sites}
            attendance={attendance}
            employees={employees}
          />
        )}
        {reportId === 'overtime-report' && (
          <OvertimeReport
            employees={employees}
            attendance={attendance}
          />
        )}
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
// ATTENDANCE SUMMARY REPORT
// =====================================================

function AttendanceSummaryReport({
  employees,
  attendance,
  sites,
}: {
  employees: UserProfile[];
  attendance: SimpleAttendance[];
  sites: any[];
}) {
  const employeeAttendance = useMemo(() => {
    const map: Record<string, { name: string; daysPresent: number; halfDays: number; otHours: number }> = {};
    
    attendance.forEach(record => {
      if (!map[record.workerId]) {
        map[record.workerId] = { name: record.workerName, daysPresent: 0, halfDays: 0, otHours: 0 };
      }
      const hasMorning = !!record.morningSite;
      const hasEvening = !!record.eveningSite;
      if (hasMorning && hasEvening) {
        map[record.workerId].daysPresent++;
      } else if (hasMorning || hasEvening) {
        map[record.workerId].halfDays++;
      }
      map[record.workerId].otHours += record.otHours || 0;
    });

    return Object.entries(map)
      .map(([workerId, data]) => ({ workerId, ...data }))
      .sort((a, b) => b.daysPresent - a.daysPresent);
  }, [attendance]);

  if (employeeAttendance.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        No attendance records found for this period
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 sm:p-4">
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-blue-500">{attendance.length}</p>
          <p className="text-sm text-muted-foreground">Total Records</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-green-500">{employeeAttendance.length}</p>
          <p className="text-sm text-muted-foreground">Employees Tracked</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-orange-500">
            {employeeAttendance.reduce((sum, e) => sum + e.otHours, 0).toFixed(1)}
          </p>
          <p className="text-sm text-muted-foreground">Total OT Hours</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-3 font-medium text-muted-foreground">Employee</th>
              <th className="p-3 font-medium text-muted-foreground text-center">Full Days</th>
              <th className="p-3 font-medium text-muted-foreground text-center">Half Days</th>
              <th className="p-3 font-medium text-muted-foreground text-center">OT Hours</th>
            </tr>
          </thead>
          <tbody>
            {employeeAttendance.map((emp) => (
              <tr key={emp.workerId} className="border-b border-border/50">
                <td className="p-3 font-medium">{emp.name}</td>
                <td className="p-3 text-center">
                  <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-green-400">
                    {emp.daysPresent}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-yellow-400">
                    {emp.halfDays}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-blue-400">
                    {emp.otHours.toFixed(1)}
                  </span>
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
// PAYROLL SUMMARY REPORT
// =====================================================

function PayrollSummaryReport({
  employees,
  attendance,
  sites,
}: {
  employees: UserProfile[];
  attendance: SimpleAttendance[];
  sites: WorkSite[];
}) {
  const siteNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    sites.forEach(s => { map[s.id] = s.name; });
    return map;
  }, [sites]);

  const { workerData, siteAggregates, grandTotal } = useMemo(() => {
    const employeeMap: Record<string, UserProfile> = {};
    employees.forEach(e => {
      employeeMap[e.uid] = e;
      if (e.workerId) employeeMap[e.workerId] = e;
    });

    // worker → site → { days, ot }
    const workerSiteMap: Record<string, {
      name: string;
      dailyRate: number;
      otRate: number;
      sites: Record<string, { daysWorked: number; otHours: number }>;
    }> = {};

    attendance.forEach(record => {
      const emp = employeeMap[record.workerId];
      const dailyRate = emp?.dailyRate || 0;
      if (!workerSiteMap[record.workerId]) {
        workerSiteMap[record.workerId] = {
          name: record.workerName,
          dailyRate,
          otRate: calculateOtHourlyRate(dailyRate),
          sites: {},
        };
      }
      const w = workerSiteMap[record.workerId];

      const morSite = record.morningSite;
      const eveSite = record.eveningSite;

      if (morSite) {
        if (!w.sites[morSite]) w.sites[morSite] = { daysWorked: 0, otHours: 0 };
        w.sites[morSite].daysWorked += 0.5;
      }
      if (eveSite) {
        if (!w.sites[eveSite]) w.sites[eveSite] = { daysWorked: 0, otHours: 0 };
        w.sites[eveSite].daysWorked += 0.5;
      }
      const ot = record.otHours || 0;
      if (ot > 0) {
        const otSite = eveSite || morSite;
        if (otSite) {
          if (!w.sites[otSite]) w.sites[otSite] = { daysWorked: 0, otHours: 0 };
          w.sites[otSite].otHours += ot;
        }
      }
    });

    // Build display data
    const workerData = Object.entries(workerSiteMap).map(([workerId, w]) => {
      const siteBreakdowns = Object.entries(w.sites).map(([siteId, s]) => {
        const pay = s.daysWorked * w.dailyRate + s.otHours * w.otRate;
        return { siteId, siteName: siteNameMap[siteId] || siteId, ...s, pay };
      });
      const totalPay = siteBreakdowns.reduce((sum, s) => sum + s.pay, 0);
      return { workerId, name: w.name, siteBreakdowns, totalPay };
    }).sort((a, b) => b.totalPay - a.totalPay);

    // Site aggregates
    const siteAgg: Record<string, number> = {};
    workerData.forEach(w => {
      w.siteBreakdowns.forEach(sb => {
        siteAgg[sb.siteId] = (siteAgg[sb.siteId] || 0) + sb.pay;
      });
    });
    const siteAggregates = Object.entries(siteAgg)
      .map(([siteId, total]) => ({ siteId, siteName: siteNameMap[siteId] || siteId, total }))
      .sort((a, b) => b.total - a.total);

    const grandTotal = workerData.reduce((sum, w) => sum + w.totalPay, 0);

    return { workerData, siteAggregates, grandTotal };
  }, [employees, attendance, siteNameMap]);

  if (workerData.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        No payroll data available for this period
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Worker Payroll Breakdown */}
      <div>
        <h3 className="mb-3 font-semibold text-foreground">Worker Payroll Report</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 font-medium text-muted-foreground">Employee</th>
                <th className="p-3 font-medium text-muted-foreground">Site</th>
                <th className="p-3 font-medium text-muted-foreground text-center">Days</th>
                <th className="p-3 font-medium text-muted-foreground text-center">OT Hrs</th>
                <th className="p-3 font-medium text-muted-foreground text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {workerData.map((worker) => (
                <>
                  {worker.siteBreakdowns.map((sb, idx) => (
                    <tr key={`${worker.workerId}-${sb.siteId}`} className="border-b border-border/30">
                      {idx === 0 && (
                        <td className="p-3 font-medium" rowSpan={worker.siteBreakdowns.length + 1}>
                          {worker.name}
                        </td>
                      )}
                      <td className="p-3 text-muted-foreground">{sb.siteName}</td>
                      <td className="p-3 text-center">{sb.daysWorked}</td>
                      <td className="p-3 text-center">{sb.otHours > 0 ? sb.otHours.toFixed(1) : '—'}</td>
                      <td className="p-3 text-right">{formatCurrency(sb.pay)}</td>
                    </tr>
                  ))}
                  <tr key={`${worker.workerId}-total`} className="border-b border-border bg-muted/20">
                    <td className="p-3 font-semibold text-right" colSpan={3}>Worker Total</td>
                    <td className="p-3 text-right font-bold text-green-500">{formatCurrency(worker.totalPay)}</td>
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Site Totals */}
      <div>
        <h3 className="mb-3 font-semibold text-foreground">Site Summary</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {siteAggregates.map(sa => (
            <div key={sa.siteId} className="rounded-lg border border-border p-3">
              <p className="text-sm text-muted-foreground">{sa.siteName}</p>
              <p className="text-xl font-bold text-blue-500">{formatCurrency(sa.total)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Grand Total */}
      <div className="rounded-lg border-2 border-green-500/30 bg-green-500/5 p-4 text-center">
        <p className="text-sm text-muted-foreground">Grand Total Payroll</p>
        <p className="text-3xl font-bold text-green-500">{formatCurrency(grandTotal)}</p>
      </div>
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
      if (!groups[emp.role]) groups[emp.role] = [];
      groups[emp.role].push(emp);
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
// SITE REPORT
// =====================================================

function SiteReport({
  sites,
  attendance,
}: {
  sites: any[];
  attendance: SimpleAttendance[];
  employees: UserProfile[];
}) {
  const siteData = useMemo(() => {
    const siteWorkerMap: Record<string, Set<string>> = {};
    const siteDayMap: Record<string, Set<string>> = {};

    attendance.forEach(record => {
      [record.morningSite, record.eveningSite].forEach(siteId => {
        if (siteId) {
          if (!siteWorkerMap[siteId]) siteWorkerMap[siteId] = new Set();
          if (!siteDayMap[siteId]) siteDayMap[siteId] = new Set();
          siteWorkerMap[siteId].add(record.workerId);
          siteDayMap[siteId].add(record.date);
        }
      });
    });

    return sites.map(site => ({
      ...site,
      uniqueWorkers: siteWorkerMap[site.id]?.size || 0,
      activeDays: siteDayMap[site.id]?.size || 0,
    })).sort((a: any, b: any) => b.uniqueWorkers - a.uniqueWorkers);
  }, [sites, attendance]);

  if (sites.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        No active sites found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-3 font-medium text-muted-foreground">Site Name</th>
              <th className="p-3 font-medium text-muted-foreground">Code</th>
              <th className="p-3 font-medium text-muted-foreground">Location</th>
              <th className="p-3 font-medium text-muted-foreground text-center">Workers</th>
              <th className="p-3 font-medium text-muted-foreground text-center">Active Days</th>
              <th className="p-3 font-medium text-muted-foreground text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {siteData.map((site: any) => (
              <tr key={site.id} className="border-b border-border/50">
                <td className="p-3 font-medium">{site.name}</td>
                <td className="p-3 text-muted-foreground">{site.code || '-'}</td>
                <td className="p-3 text-muted-foreground">{site.city || site.address || '-'}</td>
                <td className="p-3 text-center">
                  <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-blue-400">
                    {site.uniqueWorkers}
                  </span>
                </td>
                <td className="p-3 text-center">{site.activeDays}</td>
                <td className="p-3 text-center">
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs capitalize',
                    site.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                  )}>
                    {site.status}
                  </span>
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
// OVERTIME REPORT
// =====================================================

function OvertimeReport({
  employees,
  attendance,
}: {
  employees: UserProfile[];
  attendance: SimpleAttendance[];
}) {
  const overtimeData = useMemo(() => {
    const employeeMap: Record<string, UserProfile> = {};
    employees.forEach(e => { employeeMap[e.uid] = e; });

    const workerOT: Record<string, { name: string; otHours: number; otRate: number; days: number }> = {};

    attendance.forEach(record => {
      if ((record.otHours || 0) > 0) {
        if (!workerOT[record.workerId]) {
          const emp = employeeMap[record.workerId];
          const dailyRate = emp?.dailyRate || 0;
          workerOT[record.workerId] = {
            name: record.workerName,
            otHours: 0,
            otRate: calculateOtHourlyRate(dailyRate),
            days: 0,
          };
        }
        workerOT[record.workerId].otHours += (record.otHours || 0);
        workerOT[record.workerId].days++;
      }
    });

    return Object.entries(workerOT)
      .map(([workerId, data]) => ({
        workerId,
        ...data,
        otPay: data.otHours * data.otRate,
      }))
      .sort((a, b) => b.otHours - a.otHours);
  }, [employees, attendance]);

  const totalOTHours = overtimeData.reduce((sum, d) => sum + d.otHours, 0);
  const totalOTPay = overtimeData.reduce((sum, d) => sum + d.otPay, 0);

  if (overtimeData.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        No overtime records found for this period
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 sm:p-4">
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-orange-500">{totalOTHours.toFixed(1)}</p>
          <p className="text-sm text-muted-foreground">Total OT Hours</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-green-500">{formatCurrency(totalOTPay)}</p>
          <p className="text-sm text-muted-foreground">Total OT Pay</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-xl sm:text-2xl font-bold text-blue-500">{overtimeData.length}</p>
          <p className="text-sm text-muted-foreground">Employees with OT</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-3 font-medium text-muted-foreground">Employee</th>
              <th className="p-3 font-medium text-muted-foreground text-center">OT Days</th>
              <th className="p-3 font-medium text-muted-foreground text-center">OT Hours</th>
              <th className="p-3 font-medium text-muted-foreground text-right">OT Rate/hr</th>
              <th className="p-3 font-medium text-muted-foreground text-right">OT Pay</th>
            </tr>
          </thead>
          <tbody>
            {overtimeData.map((emp) => (
              <tr key={emp.workerId} className="border-b border-border/50">
                <td className="p-3 font-medium">{emp.name}</td>
                <td className="p-3 text-center">{emp.days}</td>
                <td className="p-3 text-center">{emp.otHours.toFixed(1)}</td>
                <td className="p-3 text-right">{formatCurrency(emp.otRate)}</td>
                <td className="p-3 text-right font-semibold">{formatCurrency(emp.otPay)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-bold">
              <td className="p-3" colSpan={2}>Total</td>
              <td className="p-3 text-center">{totalOTHours.toFixed(1)}</td>
              <td className="p-3"></td>
              <td className="p-3 text-right">{formatCurrency(totalOTPay)}</td>
            </tr>
          </tfoot>
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