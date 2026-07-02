'use client';

/**
 * =====================================================
 * PAYROLL PAGE
 * =====================================================
 * Weekly payroll with daily running totals.
 * Mon-Sat cycle, pay on Saturday, resets Monday.
 * Shows live calculation from attendance + saved payroll records.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Users,
  Clock,
  TrendingUp,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Wallet,
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
import type { PayrollStatus, UserRole, WeeklyPayroll, SimpleAttendance, UserProfile } from '@/types';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Status configuration
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
  driver: 'bg-teal-500/20 text-teal-400',
};

interface DailyBreakdown {
  date: string;
  dayName: string;
  workersPresent: number;
  dailyTotal: number;
  runningTotal: number;
  isPast: boolean;
  isToday: boolean;
}

interface EmployeeWeekSummary {
  employeeId: string;
  employeeName: string;
  employeeRole: UserRole;
  daysWorked: number;
  otHours: number;
  grossPay: number;
  dailyRate: number;
  otRate: number;
}

export default function PayrollPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthorized, user } = useRequireRole(['owner', 'ceo', 'manager']);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  // Week boundaries (Monday start)
  const weekStart = getWeekStart(selectedDate);
  const weekNumber = getWeekNumber(selectedDate);

  // Saturday = weekStart (Monday) + 5 days
  const saturday = new Date(weekStart);
  saturday.setDate(weekStart.getDate() + 5);

  const weekStartStr = toISODateString(weekStart);
  const saturdayStr = toISODateString(saturday);
  const today = toISODateString(new Date());

  // Fetch attendance for the week (Mon-Sat)
  const { data: weekAttendance = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ['week-attendance', weekStartStr, saturdayStr],
    queryFn: () => getSimpleAttendanceForDateRange(weekStartStr, saturdayStr),
  });

  // Fetch active employees (for daily rates)
  const { data: employees = [] } = useQuery({
    queryKey: ['active-employees'],
    queryFn: getActiveEmployees,
  });

  // Fetch saved payroll records for this week
  const { data: payrollRecords = [], isLoading: loadingPayroll } = useQuery({
    queryKey: ['weekly-payroll', weekStartStr],
    queryFn: () => getPayrollsForWeek(weekStartStr),
  });

  const hasPayrollGenerated = payrollRecords.length > 0;

  // Build employee map for rate lookup
  const employeeMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    employees.forEach(emp => {
      map.set(emp.workerId || emp.uid, emp);
      if (emp.workerId) map.set(emp.uid, emp);
    });
    return map;
  }, [employees]);

  // Calculate daily breakdown from attendance
  const dailyBreakdown = useMemo((): DailyBreakdown[] => {
    const days: DailyBreakdown[] = [];
    let runningTotal = 0;

    for (let i = 0; i < 6; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      const dateStr = toISODateString(dayDate);

      const dayAttendance = weekAttendance.filter(a => a.date === dateStr);

      let dailyTotal = 0;
      const workersPresent = new Set<string>();

      for (const record of dayAttendance) {
        const emp = employeeMap.get(record.workerId);
        const dailyRate = emp?.dailyRate || 0;
        const otRate = emp?.otRate || 0;

        const hasMorning = !!record.morningSite;
        const hasEvening = !!record.eveningSite;

        if (hasMorning || hasEvening) {
          workersPresent.add(record.workerId);
          const presence = hasMorning && hasEvening ? 1 : 0.5;
          dailyTotal += presence * dailyRate + (record.otHours || 0) * otRate;
        }
      }

      runningTotal += dailyTotal;

      days.push({
        date: dateStr,
        dayName: DAY_NAMES[i],
        workersPresent: workersPresent.size,
        dailyTotal,
        runningTotal,
        isPast: dateStr < today,
        isToday: dateStr === today,
      });
    }

    return days;
  }, [weekAttendance, employeeMap, weekStart, today]);

  // Calculate per-employee weekly summary from attendance
  const employeeSummaries = useMemo((): EmployeeWeekSummary[] => {
    const summaryMap = new Map<string, EmployeeWeekSummary>();

    for (const record of weekAttendance) {
      const emp = employeeMap.get(record.workerId);
      if (!emp) continue;

      const hasMorning = !!record.morningSite;
      const hasEvening = !!record.eveningSite;
      if (!hasMorning && !hasEvening) continue;

      const presence = hasMorning && hasEvening ? 1 : 0.5;
      const key = record.workerId;

      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          employeeId: emp.uid,
          employeeName: emp.displayName || emp.email,
          employeeRole: emp.role || 'helper',
          daysWorked: 0,
          otHours: 0,
          grossPay: 0,
          dailyRate: emp.dailyRate || 0,
          otRate: emp.otRate || 0,
        });
      }

      const summary = summaryMap.get(key)!;
      summary.daysWorked += presence;
      summary.otHours += record.otHours || 0;
      summary.grossPay += presence * (emp.dailyRate || 0) + (record.otHours || 0) * (emp.otRate || 0);
    }

    return Array.from(summaryMap.values())
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }, [weekAttendance, employeeMap]);

  // Filter
  const filteredSummaries = employeeSummaries.filter(s =>
    !searchQuery || s.employeeName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredPayroll = payrollRecords.filter(r =>
    !searchQuery || r.employeeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Totals
  const weekTotal = dailyBreakdown.length > 0
    ? dailyBreakdown[dailyBreakdown.length - 1].runningTotal
    : 0;
  const totalWorkers = employeeSummaries.length;
  const totalOtHours = employeeSummaries.reduce((s, e) => s + e.otHours, 0);

  // Generate payroll mutation
  const generateMutation = useMutation({
    mutationFn: () => generateWeeklyPayroll(weekStart, user?.uid || ''),
    onSuccess: (data) => {
      toast({
        title: 'Payroll Generated',
        description: `Generated payroll for ${data.success} employees.${data.failed > 0 ? ` ${data.failed} failed.` : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ['weekly-payroll'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate payroll',
        variant: 'destructive',
      });
    },
  });

  // Mark as paid
  const markPaidMutation = useMutation({
    mutationFn: (payrollId: string) => markAsPaid(payrollId, 'cash'),
    onSuccess: () => {
      toast({ title: 'Marked as Paid' });
      queryClient.invalidateQueries({ queryKey: ['weekly-payroll'] });
    },
  });

  // Approve
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
  };

  const isLoading = loadingAttendance || loadingPayroll;

  if (!isAuthorized) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payroll</h1>
          <p className="text-muted-foreground">
            Weekly salary tracking &mdash; Pay day every Saturday
          </p>
        </div>

        {/* Week Navigation */}
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

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-500/20 p-2">
                    <DollarSign className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Week Total</p>
                    <p className="text-xl font-bold">{formatCurrency(weekTotal)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/20 p-2">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Workers</p>
                    <p className="text-xl font-bold">{totalWorkers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-500/20 p-2">
                    <Clock className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total OT</p>
                    <p className="text-xl font-bold">{totalOtHours.toFixed(1)}h</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-orange-500/20 p-2">
                    <TrendingUp className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-xl font-bold">
                      {hasPayrollGenerated ? 'Generated' : 'Live'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Daily Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="p-4 font-medium text-muted-foreground">Day</th>
                      <th className="p-4 font-medium text-muted-foreground">Date</th>
                      <th className="p-4 text-center font-medium text-muted-foreground">Workers</th>
                      <th className="p-4 text-right font-medium text-muted-foreground">Daily Total</th>
                      <th className="p-4 text-right font-medium text-muted-foreground">Running Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyBreakdown.map((day) => (
                      <tr
                        key={day.date}
                        className={cn(
                          'border-b border-border/50 transition-colors',
                          day.isToday && 'bg-primary/5 font-medium',
                          !day.isPast && !day.isToday && 'opacity-50'
                        )}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{day.dayName}</span>
                            {day.isToday && (
                              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-xs text-primary">
                                Today
                              </span>
                            )}
                            {day.dayName === 'Saturday' && (
                              <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-xs text-green-500">
                                Pay Day
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {formatDate(new Date(day.date + 'T12:00:00'))}
                        </td>
                        <td className="p-4 text-center">{day.workersPresent}</td>
                        <td className="p-4 text-right font-medium">
                          {formatCurrency(day.dailyTotal)}
                        </td>
                        <td className="p-4 text-right">
                          <span className="font-bold text-green-500">
                            {formatCurrency(day.runningTotal)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30">
                      <td colSpan={3} className="p-4 font-bold">
                        Week Total (to be paid Saturday)
                      </td>
                      <td className="p-4 text-right font-bold">
                        {formatCurrency(weekTotal)}
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-lg font-bold text-green-500">
                          {formatCurrency(weekTotal)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {!hasPayrollGenerated && (
              <Button
                className="gap-2"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || employeeSummaries.length === 0}
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4" />
                )}
                Generate Weekly Payroll
              </Button>
            )}
          </div>

          {/* Employee Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {hasPayrollGenerated ? 'Payroll Records' : 'Employee Earnings (Live from Attendance)'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {hasPayrollGenerated ? (
                /* Saved payroll records */
                filteredPayroll.length === 0 ? (
                  <div className="flex h-32 items-center justify-center text-muted-foreground">
                    No matching records
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="p-4 font-medium text-muted-foreground">Employee</th>
                          <th className="p-4 font-medium text-muted-foreground">Days</th>
                          <th className="p-4 font-medium text-muted-foreground">OT</th>
                          <th className="p-4 font-medium text-muted-foreground">Gross</th>
                          <th className="p-4 font-medium text-muted-foreground">Deductions</th>
                          <th className="p-4 font-medium text-muted-foreground">Net</th>
                          <th className="p-4 font-medium text-muted-foreground">Status</th>
                          <th className="p-4 font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayroll.map((record) => (
                          <tr key={record.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-medium text-primary">
                                  {record.employeeName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium">{record.employeeName}</p>
                                  <span className={cn(
                                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                    roleBadgeColors[record.employeeRole || 'helper']
                                  )}>
                                    {record.employeeRole || 'Employee'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="font-medium">{record.daysWorked}</span>
                              <span className="text-muted-foreground"> / 6</span>
                            </td>
                            <td className="p-4">
                              {record.overtimeHours > 0 ? (
                                <span className="text-orange-500">{record.overtimeHours.toFixed(1)}h</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-4 font-medium">{formatCurrency(record.totalEarnings)}</td>
                            <td className="p-4">
                              {record.totalDeductions > 0 ? (
                                <span className="text-red-500">-{formatCurrency(record.totalDeductions)}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-4">
                              <span className="text-lg font-bold text-green-500">
                                {formatCurrency(record.netPay)}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                                statusConfig[record.status].color
                              )}>
                                {statusConfig[record.status].icon}
                                {statusConfig[record.status].label}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                {record.status === 'draft' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-1"
                                    onClick={() => approveMutation.mutate(record.id)}
                                    disabled={approveMutation.isPending}
                                  >
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    Approve
                                  </Button>
                                )}
                                {record.status === 'approved' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1 text-green-500 hover:text-green-400"
                                    onClick={() => markPaidMutation.mutate(record.id)}
                                    disabled={markPaidMutation.isPending}
                                  >
                                    <Wallet className="h-3.5 w-3.5" />
                                    Mark Paid
                                  </Button>
                                )}
                                {record.status === 'paid' && (
                                  <span className="text-xs text-green-500">&#10003; Paid</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                /* Live calculation from attendance */
                filteredSummaries.length === 0 ? (
                  <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Users className="h-10 w-10" />
                    <p>No attendance marked for this week yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="p-4 font-medium text-muted-foreground">Employee</th>
                          <th className="p-4 font-medium text-muted-foreground">Daily Rate</th>
                          <th className="p-4 font-medium text-muted-foreground">Days Worked</th>
                          <th className="p-4 font-medium text-muted-foreground">OT Hours</th>
                          <th className="p-4 font-medium text-muted-foreground">Earned</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSummaries.map((emp) => (
                          <tr key={emp.employeeId} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-medium text-primary">
                                  {emp.employeeName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium">{emp.employeeName}</p>
                                  <span className={cn(
                                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                    roleBadgeColors[emp.employeeRole]
                                  )}>
                                    {emp.employeeRole}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-muted-foreground">{formatCurrency(emp.dailyRate)}</td>
                            <td className="p-4 font-medium">{emp.daysWorked} / 6</td>
                            <td className="p-4">
                              {emp.otHours > 0 ? (
                                <span className="text-orange-500">{emp.otHours.toFixed(1)}h</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-4">
                              <span className="text-lg font-bold text-green-500">
                                {formatCurrency(emp.grossPay)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </CardContent>
          </Card>

          {/* Summary Footer */}
          {(filteredSummaries.length > 0 || filteredPayroll.length > 0) && (
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="text-sm text-muted-foreground">
                    {hasPayrollGenerated
                      ? `${filteredPayroll.length} payroll records`
                      : `${filteredSummaries.length} employees — live calculation from attendance`}
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Total Payable: </span>
                      <span className="text-lg font-bold text-green-500">
                        {formatCurrency(
                          hasPayrollGenerated
                            ? filteredPayroll.reduce((s, r) => s + r.netPay, 0)
                            : weekTotal
                        )}
                      </span>
                    </div>
                    {hasPayrollGenerated && (
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-green-500/20 px-2 py-1 text-xs text-green-500">
                          {filteredPayroll.filter(r => r.status === 'paid').length} Paid
                        </span>
                        <span className="rounded bg-yellow-500/20 px-2 py-1 text-xs text-yellow-500">
                          {filteredPayroll.filter(r => r.status !== 'paid' && r.status !== 'cancelled').length} Pending
                        </span>
                      </div>
                    )}
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
