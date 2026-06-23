'use client';

/**
 * =====================================================
 * ADVANCES PAGE - WEEKLY VIEW
 * =====================================================
 * Salary advance request management with weekly payroll alignment.
 * Shows advances grouped by week: "This Week" and "Carry Forward"
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
  ChevronLeft,
  ChevronRight,
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
  checkDuplicatePendingAdvance,
  updateAdvanceRequest,
  deleteAdvance,
} from '@/services';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { formatDate, getWeekStart, getWeekEnd, formatWeekRange, toISODateString, subWeeks, addWeeks } from '@/lib/date-utils';
import { groupWeeklyAdvances } from '@/domain/advances/grouping';
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

// Badge component for weekly classification
function WeeklyBadge({ type }: { type: 'thisWeek' | 'carryForward' | 'pending' | 'approved' | 'rejected' | 'deducted' }) {
  const config = {
    thisWeek: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'This Week' },
    carryForward: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Carry Forward' },
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Pending Approval' },
    approved: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Approved' },
    rejected: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Rejected' },
    deducted: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Deducted' },
  };

  const { bg, text, label } = config[type];
  return (
    <span className={cn('inline-flex items-center rounded-full border border-opacity-30 px-2 py-0.5 text-xs font-medium', bg, text)}>
      {label}
    </span>
  );
}

export default function AdvancesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthorized, user } = useRequireRole(['owner', 'ceo', 'manager']);

  // Week selector
  const [selectedDate, setSelectedDate] = useState(new Date());
  const weekStart = getWeekStart(selectedDate);
  const weekEnd = getWeekEnd(selectedDate);
  const weekStartISO = toISODateString(weekStart);
  const weekEndISO = toISODateString(weekEnd);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('pending');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);
  const [newAdvance, setNewAdvance] = useState({
    employeeId: '',
    amount: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Fetch all advances (both pending and approved for the admin view)
  const {
    data: allAdvancesData,
    isLoading,
  } = useQuery({
    queryKey: ['advances', { page: 1, limit: 200 }],
    queryFn: () => getAdvancesPaginated({ page: 1, limit: 200 }),
  });

  const allAdvances = allAdvancesData?.data || [];

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
    mutationFn: async () => {
      const employee = employees.find((e: any) => e.uid === newAdvance.employeeId);
      if (!employee) throw new Error('Please select an employee');

      const amount = parseFloat(newAdvance.amount);

      const hasPendingAdvance = await checkDuplicatePendingAdvance(newAdvance.employeeId);
      if (hasPendingAdvance) {
        throw new Error('Employee already has a pending advance request. Supervisor must approve or reject it first.');
      }

      return createAdvanceRequest({
        employeeId: newAdvance.employeeId,
        employeeName: employee.displayName || 'Unknown',
        amount,
        reason: newAdvance.reason,
        requestedAt: newAdvance.date,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Advance Created',
        description: 'The advance request has been created.',
      });
      setShowCreateModal(false);
      setNewAdvance({ employeeId: '', amount: '', reason: '', date: new Date().toISOString().split('T')[0] });
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

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: ({ id, amount, reason }: any) =>
      updateAdvanceRequest(id, { amount, reason }),
    onSuccess: () => {
      toast({
        title: 'Advance Updated',
        description: 'The advance request has been updated.',
      });
      setShowEditModal(false);
      setEditingAdvanceId(null);
      setNewAdvance({ employeeId: '', amount: '', reason: '', date: new Date().toISOString().split('T')[0] });
      queryClient.invalidateQueries({ queryKey: ['advances'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update advance',
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (advanceId: string) => deleteAdvance(advanceId),
    onSuccess: () => {
      toast({
        title: 'Advance Deleted',
        description: 'The advance request has been cancelled.',
      });
      queryClient.invalidateQueries({ queryKey: ['advances'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete advance',
        variant: 'destructive',
      });
    },
  });

  // Filter advances by search
  const searchFiltered = allAdvances.filter((advance) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        advance.employeeName.toLowerCase().includes(query) ||
        advance.reason?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Filter by status for approval section
  const pendings = searchFiltered.filter(a => a.status === 'pending');

  // Get approved advances for weekly view (only show approved & undeducted)
  const approvedUndeducted = searchFiltered.filter(a => {
    const isDed = (a as any).isDeducted || (a as any).deducted || false;
    return a.status === 'approved' && !isDed;
  });

  // Group weekly advances
  const { thisWeek, carryForward } = groupWeeklyAdvances(
    approvedUndeducted,
    weekStartISO,
    weekEndISO
  );

  // Calculate weekly stats
  const thisWeekTotal = thisWeek.reduce((sum, a) => sum + a.amount, 0);
  const carryForwardTotal = carryForward.reduce((sum, a) => sum + a.amount, 0);
  const totalPendingApproval = pendings.reduce((sum, a) => sum + a.amount, 0);

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Salary Advances</h1>
          <p className="text-muted-foreground">
            Manage employee advance requests by week
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />
          New Advance
        </Button>
      </div>

      {/* Week Selector */}
      <Card className="bg-card/50">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(subWeeks(selectedDate, 1))}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <div className="text-center min-w-[250px]">
                <p className="text-sm font-medium text-muted-foreground">Week</p>
                <p className="text-lg font-bold">{formatWeekRange(weekStart)}</p>
                <p className="text-xs text-muted-foreground">{weekStartISO} to {weekEndISO}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(addWeeks(selectedDate, 1))}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date())}
            >
              Today
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Summary Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3">
        <Card className="bg-card/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/20 p-2">
                <Calendar className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">This Week</p>
                <p className="text-lg sm:text-2xl font-bold">{thisWeek.length}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(thisWeekTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/20 p-2">
                <Wallet className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Carry Forward</p>
                <p className="text-lg sm:text-2xl font-bold">{carryForward.length}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(carryForwardTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-500/20 p-2">
                <Clock className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Pending Approval</p>
                <p className="text-lg sm:text-2xl font-bold">{pendings.length}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(totalPendingApproval)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approval Section */}
      {pendings.length > 0 && (
        <Card className="bg-card/50 border-yellow-500/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
              <CardTitle>Pending Approval ({pendings.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {pendings.map((advance) => (
                <div
                  key={advance.id}
                  className="p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
                        {advance.employeeName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{advance.employeeName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(advance.requestedAt || advance.createdAt)}
                          {advance.reason && <span className="truncate">• {advance.reason}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-green-400">{formatCurrency(advance.amount)}</p>
                        <WeeklyBadge type="pending" />
                      </div>
                      <div className="flex gap-2 flex-wrap">
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
                    </div>
                  </div>
                  {rejectingId === advance.id && (
                    <div className="mt-3 flex gap-2 rounded-lg border border-border bg-background p-3">
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
                          reason: rejectReason,
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
          </CardContent>
        </Card>
      )}

      {/* This Week's Advances */}
      <Card className="bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-400" />
            This Week ({thisWeek.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {thisWeek.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-muted-foreground">
              <Wallet className="h-10 w-10 mb-2" />
              <p>No advances created this week</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {thisWeek.map((advance) => (
                <div key={advance.id} className="p-4 transition-colors hover:bg-muted/30">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
                        {advance.employeeName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{advance.employeeName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(advance.requestedAt || advance.createdAt)}
                          {advance.reason && <span className="truncate">• {advance.reason}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-green-400">{formatCurrency(advance.amount)}</p>
                        <WeeklyBadge type="thisWeek" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Carry Forward Advances */}
      <Card className="bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-purple-400" />
            Carry Forward ({carryForward.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {carryForward.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-muted-foreground">
              <Wallet className="h-10 w-10 mb-2" />
              <p>No carry forward advances</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {carryForward.map((advance) => {
                const advanceWeekStart = toISODateString(
                  getWeekStart(typeof advance.requestedAt === 'string'
                    ? new Date(advance.requestedAt)
                    : advance.requestedAt)
                );
                return (
                  <div key={advance.id} className="p-4 transition-colors hover:bg-muted/30">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
                          {advance.employeeName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium">{advance.employeeName}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(advance.requestedAt || advance.createdAt)}
                            {advance.reason && <span className="truncate">• {advance.reason}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-green-400">{formatCurrency(advance.amount)}</p>
                          <WeeklyBadge type="carryForward" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                />
              </div>

              <div className="space-y-2">
                <Label required>Advance Date</Label>
                <Input
                  type="date"
                  value={newAdvance.date}
                  onChange={(e) => setNewAdvance(prev => ({
                    ...prev,
                    date: e.target.value
                  }))}
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
                    setNewAdvance({ employeeId: '', amount: '', reason: '', date: new Date().toISOString().split('T')[0] });
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
    </div>
  );
}
