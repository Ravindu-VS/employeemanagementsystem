'use client';

/**
 * =====================================================
 * PAYROLL PAGE
 * =====================================================
 * Weekly payroll management and generation.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Calendar,
  Search,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Users,
  Clock,
  TrendingUp,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
  Wallet,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  getPayrollsForWeek, 
  generateWeeklyPayroll,
  markAsPaid,
  updatePayrollStatus,
  getWeeklyPayrollSummary,
} from '@/services';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { 
  formatDate, 
  getWeekNumber,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
} from '@/lib/date-utils';
import type { PayrollStatus, UserRole, WeeklyPayroll, BonusEntry } from '@/types';

// Status configuration
const statusConfig: Record<PayrollStatus, {
  label: string;
  color: string;
  icon: React.ReactNode;
}> = {
  draft: {
    label: 'Draft',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: <FileText className="h-3.5 w-3.5" />,
  },
  pending_approval: {
    label: 'Pending',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  approved: {
    label: 'Approved',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
  paid: {
    label: 'Paid',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <Wallet className="h-3.5 w-3.5" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

// Role badge colors
const roleBadgeColors: Record<UserRole, string> = {
  owner: 'bg-purple-500/20 text-purple-400',
  ceo: 'bg-blue-500/20 text-blue-400',
  manager: 'bg-cyan-500/20 text-cyan-400',
  supervisor: 'bg-green-500/20 text-green-400',
  draughtsman: 'bg-yellow-500/20 text-yellow-400',
  bass: 'bg-orange-500/20 text-orange-400',
  helper: 'bg-gray-500/20 text-gray-400',
};

export default function PayrollPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthorized, user } = useRequireRole(['owner', 'ceo', 'manager']);
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PayrollStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Get week info
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = endOfWeek(selectedDate);
  const weekNumber = getWeekNumber(selectedDate);
  const year = selectedDate.getFullYear();

  // Fetch payroll for selected week
  const { 
    data: payrollRecords = [], 
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['weekly-payroll', year, weekNumber],
    queryFn: () => getPayrollsForWeek(weekStart.toISOString().split('T')[0]),
  });

  // Generate payroll mutation
  const generateMutation = useMutation({
    mutationFn: () => generateWeeklyPayroll(weekStart, user?.uid || ''),
    onSuccess: (data) => {
      toast({
        title: 'Payroll Generated',
        description: `Generated payroll for ${data.success} employees.`,
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

  // Mark as paid mutation
  const markPaidMutation = useMutation({
    mutationFn: (payrollId: string) => markAsPaid(payrollId, 'cash'),
    onSuccess: () => {
      toast({
        title: 'Marked as Paid',
        description: 'Payroll has been marked as paid.',
      });
      queryClient.invalidateQueries({ queryKey: ['weekly-payroll'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update payroll',
        variant: 'destructive',
      });
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (payrollId: string) => updatePayrollStatus(payrollId, 'approved'),
    onSuccess: () => {
      toast({
        title: 'Approved',
        description: 'Payroll has been approved.',
      });
      queryClient.invalidateQueries({ queryKey: ['weekly-payroll'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve payroll',
        variant: 'destructive',
      });
    },
  });

  // Filter records
  const filteredRecords = payrollRecords.filter((record) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        record.employeeName.toLowerCase().includes(query) ||
        record.employeeId.toLowerCase().includes(query);
      
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter !== 'all' && record.status !== statusFilter) {
      return false;
    }

    return true;
  });

  // Calculate summary
  const initial = {
    totalGross: 0,
    totalNet: 0,
    totalDeductions: 0,
    totalBonuses: 0,
    totalDays: 0,
    totalOtHours: 0,
    paidCount: 0,
    pendingCount: 0,
  };
  const summary = useMemo(() => {
    return filteredRecords.reduce((acc: typeof initial, record: WeeklyPayroll) => ({
      totalGross: acc.totalGross + record.totalEarnings,
      totalNet: acc.totalNet + record.netPay,
      totalDeductions: acc.totalDeductions + record.totalDeductions,
      totalBonuses: acc.totalBonuses + (record.bonuses?.reduce((s: number, b: BonusEntry) => s + b.amount, 0) || 0),
      totalDays: acc.totalDays + record.daysWorked,
      totalOtHours: acc.totalOtHours + record.overtimeHours,
      paidCount: acc.paidCount + (record.status === 'paid' ? 1 : 0),
      pendingCount: acc.pendingCount + (record.status === 'pending_approval' || record.status === 'draft' ? 1 : 0),
    }), initial);
  }, [filteredRecords]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    setSelectedDate(current => 
      direction === 'prev' ? subWeeks(current, 1) : addWeeks(current, 1)
    );
  };

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payroll</h1>
          <p className="text-muted-foreground">
            Weekly salary management and disbursement
          </p>
        </div>
        
        {/* Week Navigation */}
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigateWeek('prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Week {weekNumber}</span>
            <span className="text-sm text-muted-foreground">
              ({formatDate(weekStart)} - {formatDate(weekEnd)})
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigateWeek('next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/20 p-2">
                <DollarSign className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Net</p>
                <p className="text-xl font-bold">{formatCurrency(summary.totalNet)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/20 p-2">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Employees</p>
                <p className="text-xl font-bold">{filteredRecords.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/20 p-2">
                <Clock className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">OT Hours</p>
                <p className="text-xl font-bold">{summary.totalOtHours.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/20 p-2">
                <TrendingUp className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deductions</p>
                <p className="text-xl font-bold">{formatCurrency(summary.totalDeductions)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <Card className="bg-card/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1 md:min-w-[300px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
                Filters
                <ChevronDown className={cn(
                  'h-4 w-4 transition-transform',
                  showFilters && 'rotate-180'
                )} />
              </Button>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                className="gap-2"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4" />
                )}
                Generate Payroll
              </Button>
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as PayrollStatus | 'all')}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="pending_approval">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payroll Table */}
      <Card className="bg-card/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4 text-muted-foreground">
              <FileText className="h-12 w-12" />
              <p>No payroll records for this week</p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                <DollarSign className="h-4 w-4" />
                Generate Payroll
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="p-4 font-medium text-muted-foreground">Employee</th>
                    <th className="p-4 font-medium text-muted-foreground">Days</th>
                    <th className="p-4 font-medium text-muted-foreground">OT Hours</th>
                    <th className="p-4 font-medium text-muted-foreground">Gross</th>
                    <th className="p-4 font-medium text-muted-foreground">Deductions</th>
                    <th className="p-4 font-medium text-muted-foreground">Net</th>
                    <th className="p-4 font-medium text-muted-foreground">Status</th>
                    <th className="p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr 
                      key={record.id} 
                      className="border-b border-border/50 transition-colors hover:bg-muted/30"
                    >
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
                          <span className="text-orange-400">
                            {record.overtimeHours.toFixed(1)} hrs
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-4 font-medium">
                        {formatCurrency(record.totalEarnings)}
                      </td>
                      <td className="p-4">
                        {record.totalDeductions > 0 ? (
                          <span className="text-red-400">
                            -{formatCurrency(record.totalDeductions)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-lg font-bold text-green-400">
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
                              className="h-8 gap-1 text-green-400 hover:text-green-300"
                              onClick={() => markPaidMutation.mutate(record.id)}
                              disabled={markPaidMutation.isPending}
                            >
                              <Wallet className="h-3.5 w-3.5" />
                              Mark Paid
                            </Button>
                          )}
                          {record.status === 'paid' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Slip
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Footer */}
      {filteredRecords.length > 0 && (
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                Showing {filteredRecords.length} payroll records
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-sm text-muted-foreground">Total Net Payable: </span>
                  <span className="text-lg font-bold text-green-400">
                    {formatCurrency(summary.totalNet)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-green-500/20 px-2 py-1 text-xs text-green-400">
                    {summary.paidCount} Paid
                  </span>
                  <span className="rounded bg-yellow-500/20 px-2 py-1 text-xs text-yellow-400">
                    {summary.pendingCount} Pending
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
