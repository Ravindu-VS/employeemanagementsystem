'use client';

/**
 * =====================================================
 * LOANS PAGE
 * =====================================================
 * Employee loan management with EMI tracking.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search,
  Filter,
  ChevronDown,
  Plus,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Wallet,
  Calendar,
  User,
  TrendingUp,
  Receipt,
  Percent,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  getPendingLoans,
  getActiveLoans,
  getLoansPaginated,
  approveLoan,
  disburseLoan,
  rejectLoan,
  getAllEmployees,
  createLoanRequest,
  calculateLoanSchedule,
  getLoanStats,
} from '@/services';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { PAYROLL_CONFIG } from '@/constants';
import type { LoanStatus, Loan } from '@/types';

// Status configuration
const statusConfig: Record<LoanStatus, {
  label: string;
  color: string;
  icon: React.ReactNode;
}> = {
  pending: {
    label: 'Pending',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  approved: {
    label: 'Approved',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
  active: {
    label: 'Active',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <TrendingUp className="h-3.5 w-3.5" />,
  },
  completed: {
    label: 'Completed',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    icon: <Wallet className="h-3.5 w-3.5" />,
  },
  defaulted: {
    label: 'Defaulted',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

export default function LoansPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthorized, user } = useRequireRole(['owner', 'ceo', 'manager']);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LoanStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [newLoan, setNewLoan] = useState({
    employeeId: '',
    amount: '',
    emis: '12',
    reason: '',
  });
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Fetch all loans
  const { 
    data: loansData, 
    isLoading,
  } = useQuery({
    queryKey: ['loans', { status: statusFilter === 'all' ? undefined : statusFilter }],
    queryFn: () => getLoansPaginated(
      { page: 1, limit: 100 },
      statusFilter === 'all' ? undefined : { status: statusFilter }
    ),
  });

  const loans = loansData?.data || [];

  // Fetch loan stats
  const { data: stats } = useQuery({
    queryKey: ['loan-stats'],
    queryFn: getLoanStats,
  });

  // Fetch employees for create form
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: getAllEmployees,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (loanId: string) => approveLoan(loanId, user?.uid || ''),
    onSuccess: () => {
      toast({
        title: 'Loan Approved',
        description: 'The loan request has been approved.',
      });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan-stats'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve loan',
        variant: 'destructive',
      });
    },
  });

  // Disburse mutation
  const disburseMutation = useMutation({
    mutationFn: disburseLoan,
    onSuccess: () => {
      toast({
        title: 'Loan Disbursed',
        description: 'The loan has been marked as disbursed and is now active.',
      });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan-stats'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to disburse loan',
        variant: 'destructive',
      });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => 
      rejectLoan(id, reason),
    onSuccess: () => {
      toast({
        title: 'Loan Rejected',
        description: 'The loan request has been rejected.',
      });
      setRejectingId(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan-stats'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject loan',
        variant: 'destructive',
      });
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: () => {
      const employee = employees.find((e: any) => e.uid === newLoan.employeeId);
      if (!employee) throw new Error('Please select an employee');
      
      return createLoanRequest({
        employeeId: newLoan.employeeId,
        employeeName: employee.displayName || 'Unknown',
        principalAmount: parseFloat(newLoan.amount),
        totalEmis: parseInt(newLoan.emis),
        reason: newLoan.reason,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Loan Request Created',
        description: 'The loan request has been submitted for approval.',
      });
      setShowCreateModal(false);
      setNewLoan({ employeeId: '', amount: '', emis: '12', reason: '' });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan-stats'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create loan request',
        variant: 'destructive',
      });
    },
  });

  // Filter loans
  const filteredLoans = loans.filter((loan) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        loan.employeeName.toLowerCase().includes(query) ||
        loan.reason?.toLowerCase().includes(query);
      
      if (!matchesSearch) return false;
    }
    return true;
  });

  // Calculate loan preview
  const loanPreview = newLoan.amount && newLoan.emis 
    ? calculateLoanSchedule(
        parseFloat(newLoan.amount),
        PAYROLL_CONFIG.DEFAULT_INTEREST_RATE,
        parseInt(newLoan.emis)
      )
    : null;

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Loans</h1>
          <p className="text-muted-foreground">
            Manage employee loans with EMI tracking
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />
          New Loan
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
        <Card className="bg-card/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-500/20 p-2">
                <Clock className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-xl sm:text-2xl font-bold">{stats?.pending || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/20 p-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-xl sm:text-2xl font-bold">{stats?.active || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/20 p-2">
                <DollarSign className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Disbursed</p>
                <p className="text-xl font-bold">
                  {formatCurrency(stats?.totalDisbursed || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/20 p-2">
                <Receipt className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-xl font-bold">
                  {formatCurrency(stats?.totalOutstanding || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="bg-card/50">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by employee or reason..."
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

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as LoanStatus | 'all')}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loans List */}
      <Card className="bg-card/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filteredLoans.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Receipt className="h-12 w-12" />
              <p>No loans found</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredLoans.map((loan) => (
                <div 
                  key={loan.id} 
                  className="p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3 sm:p-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 font-medium text-primary">
                        {loan.employeeName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{loan.employeeName}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(loan.createdAt)}
                          </span>
                          {loan.reason && (
                            <span className="truncate max-w-[200px]">
                              {loan.reason}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-8">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Principal</p>
                        <p className="font-medium">{formatCurrency(loan.principalAmount)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="font-medium">{formatCurrency(loan.totalAmount)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">EMI</p>
                        <p className="font-medium">{formatCurrency(loan.emiAmount)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Progress</p>
                        <p className="font-medium">{loan.paidEmis} / {loan.totalEmis}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:p-4">
                      <div className="text-right">
                        {loan.status === 'active' && (
                          <p className="text-lg font-bold text-orange-400">
                            {formatCurrency(loan.remainingAmount)}
                            <span className="text-xs text-muted-foreground ml-1">remaining</span>
                          </p>
                        )}
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                          statusConfig[loan.status].color
                        )}>
                          {statusConfig[loan.status].icon}
                          {statusConfig[loan.status].label}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {loan.status === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-green-400 hover:text-green-300"
                              onClick={() => approveMutation.mutate(loan.id)}
                              disabled={approveMutation.isPending}
                            >
                              {approveMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3.5 w-3.5" />
                              )}
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-red-400 hover:text-red-300"
                              onClick={() => setRejectingId(loan.id)}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </>
                        )}
                        {loan.status === 'approved' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-blue-400 hover:text-blue-300"
                            onClick={() => disburseMutation.mutate(loan.id)}
                            disabled={disburseMutation.isPending}
                          >
                            {disburseMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Wallet className="h-3.5 w-3.5" />
                            )}
                            Disburse
                          </Button>
                        )}
                        {loan.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLoan(loan)}
                          >
                            View Details
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar for active loans */}
                  {loan.status === 'active' && (
                    <div className="mt-4">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ 
                            width: `${(loan.paidEmis / loan.totalEmis) * 100}%` 
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground text-right">
                        {((loan.paidEmis / loan.totalEmis) * 100).toFixed(0)}% complete
                      </p>
                    </div>
                  )}

                  {/* Reject reason input */}
                  {rejectingId === loan.id && (
                    <div className="mt-4 flex gap-2 rounded-lg border border-border bg-background p-3">
                      <Input
                        placeholder="Enter rejection reason..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => rejectMutation.mutate({ 
                          id: loan.id, 
                          reason: rejectReason 
                        })}
                        disabled={rejectMutation.isPending || !rejectReason}
                      >
                        {rejectMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Confirm'
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Loan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-lg bg-card">
            <CardHeader>
              <CardTitle>New Loan Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label required>Employee</Label>
                <select
                  value={newLoan.employeeId}
                  onChange={(e) => setNewLoan(prev => ({ 
                    ...prev, 
                    employeeId: e.target.value 
                  }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select employee...</option>
                  {employees.filter((e: any) => e.isActive).map((emp: any) => (
                    <option key={emp.uid} value={emp.uid}>
                      {emp.displayName || emp.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label required>Amount (LKR)</Label>
                  <Input
                    type="number"
                    placeholder="50000"
                    value={newLoan.amount}
                    onChange={(e) => setNewLoan(prev => ({ 
                      ...prev, 
                      amount: e.target.value 
                    }))}
                    icon={<DollarSign className="h-4 w-4" />}
                  />
                </div>
                <div className="space-y-2">
                  <Label required>Number of EMIs</Label>
                  <select
                    value={newLoan.emis}
                    onChange={(e) => setNewLoan(prev => ({ 
                      ...prev, 
                      emis: e.target.value 
                    }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {[3, 6, 9, 12, 18, 24].map(n => (
                      <option key={n} value={n}>{n} EMIs</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reason</Label>
                <textarea
                  placeholder="Reason for loan..."
                  value={newLoan.reason}
                  onChange={(e) => setNewLoan(prev => ({ 
                    ...prev, 
                    reason: e.target.value 
                  }))}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Loan Preview */}
              {loanPreview && (
                <div className="rounded-lg border border-border bg-muted/50 p-3 sm:p-4">
                  <p className="text-sm font-medium mb-3">Loan Summary</p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Principal</p>
                      <p className="font-medium">{formatCurrency(parseFloat(newLoan.amount))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Interest ({PAYROLL_CONFIG.DEFAULT_INTEREST_RATE}%)
                      </p>
                      <p className="font-medium text-orange-400">
                        +{formatCurrency(loanPreview.totalAmount - parseFloat(newLoan.amount))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-bold">{formatCurrency(loanPreview.totalAmount)}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border text-center">
                    <p className="text-xs text-muted-foreground">Monthly EMI</p>
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(loanPreview.emiAmount)}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewLoan({ employeeId: '', amount: '', emis: '12', reason: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={
                    createMutation.isPending || 
                    !newLoan.employeeId || 
                    !newLoan.amount
                  }
                  className="gap-2"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Submit Request
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loan Details Modal */}
      {selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-lg bg-card max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Loan Details - {selectedLoan.employeeName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Principal Amount</p>
                  <p className="font-medium">{formatCurrency(selectedLoan.principalAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Interest Rate</p>
                  <p className="font-medium">{selectedLoan.interestRate}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="font-medium">{formatCurrency(selectedLoan.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">EMI Amount</p>
                  <p className="font-medium">{formatCurrency(selectedLoan.emiAmount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">EMIs Paid</p>
                  <p className="font-medium">{selectedLoan.paidEmis} / {selectedLoan.totalEmis}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Remaining</p>
                  <p className="font-bold text-orange-400">
                    {formatCurrency(selectedLoan.remainingAmount)}
                  </p>
                </div>
              </div>

              {/* Payment History */}
              {selectedLoan.payments && selectedLoan.payments.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Payment History</p>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {selectedLoan.payments.map((payment) => (
                      <div 
                        key={payment.id}
                        className="flex items-center justify-between rounded-lg border border-border/50 p-3"
                      >
                        <div>
                          <p className="font-medium">EMI #{payment.emiNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(payment.paidAt)}
                          </p>
                        </div>
                        <p className="font-medium text-green-400">
                          {formatCurrency(payment.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setSelectedLoan(null)}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Info */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredLoans.length} loans
      </div>
    </div>
  );
}
