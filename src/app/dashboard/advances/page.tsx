'use client';

/**
 * =====================================================
 * ADVANCES PAGE
 * =====================================================
 * Salary advance request management.
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  getPendingAdvances,
  getAdvancesPaginated,
  approveAdvance,
  rejectAdvance,
  getAllEmployees,
  createAdvanceRequest,
} from '@/services';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import type { RequestStatus, AdvanceRequest } from '@/types';

// Status configuration
const statusConfig: Record<RequestStatus, {
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
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

export default function AdvancesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthorized, user } = useRequireRole(['owner', 'ceo', 'manager']);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAdvance, setNewAdvance] = useState({
    employeeId: '',
    amount: '',
    reason: '',
  });
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Fetch all advances
  const { 
    data: advancesData, 
    isLoading,
  } = useQuery({
    queryKey: ['advances', { status: statusFilter === 'all' ? undefined : statusFilter }],
    queryFn: () => getAdvancesPaginated(
      { page: 1, limit: 100 },
      statusFilter === 'all' ? undefined : { status: statusFilter }
    ),
  });

  const advances = advancesData?.data || [];

  // Fetch employees for create form
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: getAllEmployees,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (advanceId: string) => approveAdvance(advanceId, user?.uid || ''),
    onSuccess: () => {
      toast({
        title: 'Advance Approved',
        description: 'The advance request has been approved.',
      });
      queryClient.invalidateQueries({ queryKey: ['advances'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve advance',
        variant: 'destructive',
      });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => 
      rejectAdvance(id, user?.uid || '', reason),
    onSuccess: () => {
      toast({
        title: 'Advance Rejected',
        description: 'The advance request has been rejected.',
      });
      setRejectingId(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['advances'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject advance',
        variant: 'destructive',
      });
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: () => {
      const employee = employees.find((e: any) => e.uid === newAdvance.employeeId);
      if (!employee) throw new Error('Please select an employee');
      
      return createAdvanceRequest({
        employeeId: newAdvance.employeeId,
        employeeName: employee.displayName || 'Unknown',
        amount: parseFloat(newAdvance.amount),
        reason: newAdvance.reason,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Advance Created',
        description: 'The advance request has been created.',
      });
      setShowCreateModal(false);
      setNewAdvance({ employeeId: '', amount: '', reason: '' });
      queryClient.invalidateQueries({ queryKey: ['advances'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create advance',
        variant: 'destructive',
      });
    },
  });

  // Filter advances
  const filteredAdvances = advances.filter((advance) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        advance.employeeName.toLowerCase().includes(query) ||
        advance.reason?.toLowerCase().includes(query);
      
      if (!matchesSearch) return false;
    }
    return true;
  });

  // Calculate stats
  const pendingCount = advances.filter(a => a.status === 'pending').length;
  const approvedCount = advances.filter(a => a.status === 'approved').length;
  const totalPending = advances
    .filter(a => a.status === 'pending')
    .reduce((sum, a) => sum + a.amount, 0);
  const totalApproved = advances
    .filter(a => a.status === 'approved')
    .reduce((sum, a) => sum + a.amount, 0);

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Salary Advances</h1>
          <p className="text-muted-foreground">
            Manage employee advance requests
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />
          New Advance
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-500/20 p-2">
                <Clock className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/20 p-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{approvedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/20 p-2">
                <DollarSign className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Amount</p>
                <p className="text-xl font-bold">{formatCurrency(totalPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/20 p-2">
                <Wallet className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approved Amount</p>
                <p className="text-xl font-bold">{formatCurrency(totalApproved)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="bg-card/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
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
                  onChange={(e) => setStatusFilter(e.target.value as RequestStatus | 'all')}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advances List */}
      <Card className="bg-card/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filteredAdvances.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Wallet className="h-12 w-12" />
              <p>No advance requests found</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredAdvances.map((advance) => (
                <div 
                  key={advance.id} 
                  className="p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 font-medium text-primary">
                        {advance.employeeName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{advance.employeeName}</p>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(advance.createdAt)}
                          </span>
                          {advance.reason && (
                            <span className="truncate max-w-[200px]">
                              {advance.reason}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-400">
                          {formatCurrency(advance.amount)}
                        </p>
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                          statusConfig[advance.status].color
                        )}>
                          {statusConfig[advance.status].icon}
                          {statusConfig[advance.status].label}
                        </span>
                      </div>

                      {/* Actions */}
                      {advance.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-green-400 hover:text-green-300"
                            onClick={() => approveMutation.mutate(advance.id)}
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
                            onClick={() => setRejectingId(advance.id)}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reject reason input */}
                  {rejectingId === advance.id && (
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
                          id: advance.id, 
                          reason: rejectReason 
                        })}
                        disabled={rejectMutation.isPending || !rejectReason}
                      >
                        {rejectMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Confirm Reject'
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

                  {/* Show rejection reason if rejected */}
                  {advance.status === 'rejected' && advance.reviewNotes && (
                    <div className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm">
                      <span className="text-red-400">Rejection reason: </span>
                      {advance.reviewNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-card">
            <CardHeader>
              <CardTitle>New Advance Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label required>Employee</Label>
                <select
                  value={newAdvance.employeeId}
                  onChange={(e) => setNewAdvance(prev => ({ 
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

              <div className="space-y-2">
                <Label required>Amount (LKR)</Label>
                <Input
                  type="number"
                  placeholder="5000"
                  value={newAdvance.amount}
                  onChange={(e) => setNewAdvance(prev => ({ 
                    ...prev, 
                    amount: e.target.value 
                  }))}
                  icon={<DollarSign className="h-4 w-4" />}
                />
              </div>

              <div className="space-y-2">
                <Label>Reason</Label>
                <textarea
                  placeholder="Reason for advance..."
                  value={newAdvance.reason}
                  onChange={(e) => setNewAdvance(prev => ({ 
                    ...prev, 
                    reason: e.target.value 
                  }))}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewAdvance({ employeeId: '', amount: '', reason: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={
                    createMutation.isPending || 
                    !newAdvance.employeeId || 
                    !newAdvance.amount
                  }
                  className="gap-2"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Create Advance
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Info */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredAdvances.length} advance requests
      </div>
    </div>
  );
}
