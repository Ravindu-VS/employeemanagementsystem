'use client';

/**
 * =====================================================
 * MY PORTAL — employee self-service
 * =====================================================
 * Every employee (any role) sees ONLY their own data:
 * attendance by week, payslips (PDF), advances (+ request), loans, leave.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, Download, FileText, HandCoins, Landmark, Loader2, UserCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { ACCESS_MATRIX } from '@/domain/roles';
import { advanceDate, isAdvanceDeducted } from '@/domain/advances';
import { RoleBadge } from '@/components/payroll/RoleBadge';
import { getAllSites, getMyAdvances, getMyAttendance, getMyLoans, getMyPayslips, requestMyAdvance } from '@/services';
import { addDaysISO, eachDateISO, formatDate, getPayrollWeek, todayISO } from '@/lib/date-utils';
import { downloadPayslip } from '@/lib/payslip-pdf';
import { formatCurrency, cn } from '@/lib/utils';
import { ROUTES } from '@/constants';
import type { UserRole } from '@/types';

export default function MyPortalPage() {
  const { isAuthorized, profile } = useRequireRole(ACCESS_MATRIX.self_service);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [anchor, setAnchor] = useState(todayISO());
  const week = getPayrollWeek(anchor);
  const [adv, setAdv] = useState({ amount: '', reason: '', date: todayISO() });

  const enabled = isAuthorized && !!profile;
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: getAllSites, enabled });
  const { data: attendance, isLoading: loadingAtt } = useQuery({
    queryKey: ['my-attendance', profile?.uid, week.start],
    queryFn: () => getMyAttendance(profile!, week.start, week.end),
    enabled,
  });
  const { data: payslips = [], isLoading: loadingSlips } = useQuery({ queryKey: ['my-payslips', profile?.uid], queryFn: () => getMyPayslips(profile!.uid), enabled });
  const { data: advances = [] } = useQuery({ queryKey: ['my-advances', profile?.uid], queryFn: () => getMyAdvances(profile!.uid), enabled });
  const { data: loans = [] } = useQuery({ queryKey: ['my-loans', profile?.uid], queryFn: () => getMyLoans(profile!.uid), enabled });

  const siteName = (id: string | null) => (id ? sites.find((s) => s.id === id)?.name || id : 'Driver duty');
  const days = useMemo(() => {
    const byDate = new Map<string, { shifts: string[]; ot: number }>();
    for (const d of eachDateISO(week.start, week.end)) byDate.set(d, { shifts: [], ot: 0 });
    for (const s of attendance?.shifts || []) byDate.get(s.date)?.shifts.push(`${siteName(s.siteId)} · ${s.shift}`);
    for (const o of attendance?.ot || []) {
      const d = byDate.get(o.date);
      if (d) d.ot += o.hours;
    }
    return Array.from(byDate.entries());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendance, week.start, week.end, sites]);

  const requestMutation = useMutation({
    mutationFn: () => requestMyAdvance(profile!, Number(adv.amount), adv.reason, adv.date),
    onSuccess: () => {
      toast({ title: 'Advance requested', description: 'A manager will review it.' });
      setAdv({ amount: '', reason: '', date: todayISO() });
      queryClient.invalidateQueries({ queryKey: ['my-advances'] });
    },
    onError: (e: unknown) => toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' }),
  });

  if (!isAuthorized || !profile) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserCircle2 className="h-10 w-10 text-primary" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">My Portal</h1>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm">
            {profile.displayName} · {profile.workerId || profile.uid.slice(0, 8)} <RoleBadge role={profile.role as UserRole} />
            {profile.dailyRate ? <span>· Daily salary {formatCurrency(profile.dailyRate)}</span> : null}
          </p>
        </div>
      </div>

      {/* Attendance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" /> My attendance</CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-9 w-9 p-0" aria-label="Previous week" onClick={() => setAnchor(addDaysISO(week.start, -7))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-1 text-xs sm:text-sm">{formatDate(week.start, 'dd/MM')} – {formatDate(week.end, 'dd/MM/yyyy')}</span>
            <Button variant="outline" size="sm" className="h-9 w-9 p-0" aria-label="Next week" onClick={() => setAnchor(addDaysISO(week.start, 7))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingAtt ? <Spinner /> : (
            <div className="divide-y divide-border">
              {days.map(([date, d]) => (
                <div key={date} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium">{formatDate(date, 'EEE dd/MM')}</span>
                  <span className={cn('text-muted-foreground', d.shifts.length > 0 && 'text-foreground')}>
                    {d.shifts.length ? d.shifts.join(', ') : 'No attendance'}{d.ot ? ` · ${d.ot}h OT` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payslips */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> My payslips</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loadingSlips ? <Spinner /> : payslips.length === 0 ? <Empty text="No approved payroll yet" /> : (
            <div className="divide-y divide-border">
              {payslips.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div>
                    <p className="font-medium">Week {formatDate(p.weekStartDate, 'dd/MM/yyyy')}</p>
                    <p className="text-xs capitalize text-muted-foreground">{p.status} · gross {formatCurrency(p.totalEarnings)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatCurrency(p.netPay)}</span>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => downloadPayslip(p)}><Download className="h-3.5 w-3.5" /> PDF</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advances */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><HandCoins className="h-4 w-4" /> My advances</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); requestMutation.mutate(); }}>
            <div className="space-y-1"><Label htmlFor="adv-amount">Amount (LKR)</Label><Input id="adv-amount" type="number" min={1} value={adv.amount} onChange={(e) => setAdv({ ...adv, amount: e.target.value })} required /></div>
            <div className="space-y-1"><Label htmlFor="adv-date">Date</Label><Input id="adv-date" type="date" value={adv.date} onChange={(e) => setAdv({ ...adv, date: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="adv-reason">Reason</Label><Input id="adv-reason" value={adv.reason} onChange={(e) => setAdv({ ...adv, reason: e.target.value })} required /></div>
            <div className="flex items-end"><Button type="submit" className="w-full gap-2" disabled={requestMutation.isPending}>{requestMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Request advance</Button></div>
          </form>
          {advances.length === 0 ? <p className="text-sm text-muted-foreground">No advances.</p> : (
            <div className="divide-y divide-border rounded-md border border-border">
              {advances.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <span>{formatDate(advanceDate(a) || a.createdAt, 'dd/MM/yyyy')} · {a.reason}</span>
                  <span className="text-right">
                    {formatCurrency(a.amount)}
                    <span className="ml-2 text-xs capitalize text-muted-foreground">{isAdvanceDeducted(a) ? 'deducted' : a.status === 'approved' ? 'approved (outstanding)' : a.status}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loans */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Landmark className="h-4 w-4" /> My loans</CardTitle></CardHeader>
        <CardContent>
          {loans.length === 0 ? <p className="text-sm text-muted-foreground">No loans.</p> : (
            <div className="divide-y divide-border rounded-md border border-border">
              {loans.map((l) => (
                <div key={l.id} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span>{formatCurrency(l.totalAmount)} · <span className="capitalize">{l.status}</span></span>
                  <span className="text-muted-foreground">Instalment {formatCurrency(l.emiAmount)} · paid {l.paidEmis}/{l.totalEmis} · balance {formatCurrency(l.remainingAmount)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">Leave balance and requests: <Link className="text-primary underline" href={ROUTES.LEAVE}>open Leave</Link>.</p>
    </div>
  );
}

function Spinner() {
  return <div className="flex h-24 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}
function Empty({ text }: { text: string }) {
  return <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">{text}</div>;
}
