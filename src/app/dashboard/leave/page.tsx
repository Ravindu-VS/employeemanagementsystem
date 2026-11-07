'use client';

/**
 * =====================================================
 * LEAVE PAGE
 * =====================================================
 * Everyone: own balance, request leave, own history (cancel while pending).
 * Owner / CEO / Manager: all requests, approve / reject (with reason).
 * Rules: domain/leave. Leave is unpaid for daily-wage staff — payroll pays
 * attendance only.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { ACCESS_MATRIX, canAccess } from '@/domain/roles';
import { computeLeaveBalances, countLeaveDays } from '@/domain/leave';
import { cancelLeave, decideLeave, getAllLeaveRequests, getEmployeeLeaveRequests, getLeaveSettings, requestLeave } from '@/services';
import { formatDate, todayISO } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type { LeaveRequest, LeaveType } from '@/types';

const STATUS_CLASS: Record<LeaveRequest['status'], string> = {
  pending: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  approved: 'bg-green-500/15 text-green-700 dark:text-green-300',
  rejected: 'bg-red-500/15 text-red-700 dark:text-red-300',
  cancelled: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
};

export default function LeavePage() {
  const { isAuthorized, profile } = useRequireRole(ACCESS_MATRIX.leave);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isApprover = canAccess(profile?.role, 'leave_approve');
  const today = todayISO();

  const [form, setForm] = useState<{ type: LeaveType; startDate: string; endDate: string; reason: string }>({ type: 'annual', startDate: today, endDate: today, reason: '' });
  const [rejecting, setRejecting] = useState<{ id: string; notes: string } | null>(null);

  const { data: settings } = useQuery({ queryKey: ['leave-settings'], queryFn: getLeaveSettings, enabled: isAuthorized });
  const { data: mine = [], isLoading: loadingMine } = useQuery({
    queryKey: ['leaves', 'mine', profile?.uid],
    queryFn: () => getEmployeeLeaveRequests(profile!.uid),
    enabled: isAuthorized && !!profile,
  });
  const { data: all = [], isLoading: loadingAll } = useQuery({
    queryKey: ['leaves', 'all'],
    queryFn: getAllLeaveRequests,
    enabled: isAuthorized && isApprover,
  });

  const balances = useMemo(() => computeLeaveBalances(mine, today.slice(0, 4), settings), [mine, today, settings]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['leaves'] });
  const onError = (e: unknown) => toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });

  const requestMutation = useMutation({
    mutationFn: () => requestLeave({ employeeId: profile!.uid, employeeName: profile!.displayName || profile!.email, ...form }, profile!.uid),
    onSuccess: () => { toast({ title: 'Leave requested', description: 'Your manager has been notified.' }); setForm((f) => ({ ...f, reason: '' })); refresh(); },
    onError,
  });
  const decideMutation = useMutation({
    mutationFn: ({ id, decision, notes }: { id: string; decision: 'approved' | 'rejected'; notes?: string }) => decideLeave(id, decision, profile!.uid, notes),
    onSuccess: (_d, v) => { toast({ title: `Leave ${v.decision}` }); setRejecting(null); refresh(); },
    onError,
  });
  const cancelMutation = useMutation({ mutationFn: cancelLeave, onSuccess: () => { toast({ title: 'Request cancelled' }); refresh(); }, onError });

  if (!isAuthorized) return null;
  const days = countLeaveDays(form.startDate, form.endDate);
  const pendingForApproval = all.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Leave</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">Request leave · working days are Monday–Saturday · leave is unpaid for daily-wage staff</p>
      </div>

      {/* Balances */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {balances.map((b) => (
          <Card key={b.type}>
            <CardContent className="p-4">
              <p className="text-xs capitalize text-muted-foreground">{b.type} leave {today.slice(0, 4)}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{b.remaining} <span className="text-sm font-normal text-muted-foreground">/ {b.entitlement} days left</span></p>
              <p className="text-xs text-muted-foreground">{b.used} used{b.pending ? ` · ${b.pending} pending` : ''}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Request form */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" /> Request leave</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); requestMutation.mutate(); }}>
            <div className="space-y-1">
              <Label htmlFor="leave-type">Type</Label>
              <select id="leave-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as LeaveType })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="annual">Annual</option>
                <option value="sick">Sick</option>
                <option value="casual">Casual</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <div className="space-y-1"><Label htmlFor="leave-start">From</Label><Input id="leave-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="leave-end">To</Label><Input id="leave-end" type="date" value={form.endDate} min={form.startDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="leave-reason">Reason</Label><Input id="leave-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Optional" /></div>
            <div className="flex items-center justify-between gap-3 sm:col-span-4">
              <span className="text-sm text-muted-foreground">{days} working day{days === 1 ? '' : 's'}</span>
              <Button type="submit" disabled={requestMutation.isPending || days === 0} className="gap-2">
                {requestMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Submit request
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Approvals */}
      {isApprover && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Pending approval ({pendingForApproval.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loadingAll ? <Spinner /> : pendingForApproval.length === 0 ? <Empty text="No pending leave requests" /> : (
              <div className="divide-y divide-border">
                {pendingForApproval.map((r) => (
                  <div key={r.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                    <LeaveSummary r={r} showName />
                    {rejecting?.id === r.id ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input placeholder="Reason for rejection" value={rejecting.notes} onChange={(e) => setRejecting({ id: r.id, notes: e.target.value })} />
                        <Button size="sm" variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
                        <Button size="sm" variant="destructive" disabled={!rejecting.notes || decideMutation.isPending} onClick={() => decideMutation.mutate({ id: r.id, decision: 'rejected', notes: rejecting.notes })}>Reject</Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" className="gap-1" disabled={decideMutation.isPending} onClick={() => decideMutation.mutate({ id: r.id, decision: 'approved' })}><CheckCircle className="h-4 w-4" /> Approve</Button>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setRejecting({ id: r.id, notes: '' })}><XCircle className="h-4 w-4" /> Reject</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{isApprover ? 'All leave history' : 'My leave history'}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {(isApprover ? loadingAll : loadingMine) ? <Spinner /> : (isApprover ? all : mine).length === 0 ? <Empty text="No leave requests yet" /> : (
            <div className="divide-y divide-border">
              {(isApprover ? all : mine).map((r) => (
                <div key={r.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                  <LeaveSummary r={r} showName={isApprover} />
                  {r.status === 'pending' && r.employeeId === profile?.uid && (
                    <Button size="sm" variant="outline" onClick={() => cancelMutation.mutate(r.id)} disabled={cancelMutation.isPending}>Cancel request</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LeaveSummary({ r, showName }: { r: LeaveRequest; showName?: boolean }) {
  return (
    <div className="min-w-0 text-sm">
      <p className="font-medium text-foreground">
        {showName && <>{r.employeeName} · </>}
        <span className="capitalize">{r.type}</span> · {formatDate(r.startDate, 'EEE dd/MM/yyyy')}{r.endDate !== r.startDate && <> – {formatDate(r.endDate, 'EEE dd/MM/yyyy')}</>} ({r.days} day{r.days === 1 ? '' : 's'})
      </p>
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className={cn('rounded-full px-2 py-0.5 font-medium capitalize', STATUS_CLASS[r.status])}>{r.status}</span>
        {r.reason && <span>{r.reason}</span>}
        {r.reviewNotes && <span>· {r.reviewNotes}</span>}
      </p>
    </div>
  );
}

function Spinner() {
  return <div className="flex h-24 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}
function Empty({ text }: { text: string }) {
  return <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">{text}</div>;
}
