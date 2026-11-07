'use client';

/**
 * =====================================================
 * PAYROLL PAGE
 * =====================================================
 * Week selector → Overall summary → Site summary → Employee summaries →
 * Grand total. Every figure comes from the single payroll engine
 * (domain/payroll/engine.ts); this page only displays it and records the
 * administrator's advance decisions (Deduct this week / Carry forward).
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CheckCircle, Loader2,
  Wallet, ShieldCheck, AlertTriangle, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { loadPayrollInputs, generateWeeklyPayroll, getPayrollsForWeek, markAsPaid } from '@/services';
import { ACCESS_MATRIX } from '@/domain/roles';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { addDaysISO, formatDate, getPayrollWeek, getWeekNumber, todayISO, fromISODateString } from '@/lib/date-utils';
import { computePayroll } from '@/domain/payroll';
import { detectAnomalies } from '@/domain/anomalies';
import { WorkerPayrollCard } from '@/components/payroll/WorkerPayrollCard';
import { PayrollOverview, SiteTotalsTable, GrandTotalCard } from '@/components/payroll/PayrollSummary';
import { RoleBadge } from '@/components/payroll/RoleBadge';
import type { UserRole, WeeklyPayroll } from '@/types';

const selectionKey = (week: string) => `payroll-advance-selections-${week}`;

function readSelections(week: string): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(selectionKey(week));
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export default function PayrollPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAuthorized, profile } = useRequireRole(ACCESS_MATRIX.payroll);

  const [anchorDate, setAnchorDate] = useState<string>(() => todayISO());
  const week = getPayrollWeek(anchorDate);
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selections, setSelections] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState(false);

  // advance ticks: per week, remembered on this device until payroll is approved
  useEffect(() => setSelections(readSelections(week.start)), [week.start]);
  useEffect(() => {
    try { window.localStorage.setItem(selectionKey(week.start), JSON.stringify(selections)); } catch { /* storage unavailable */ }
  }, [selections, week.start]);

  // ---- DATA (loaded once per week; engine re-runs on every tick) ----
  const { data: inputs, isLoading: loadingInputs, error: inputsError } = useQuery({
    queryKey: ['payroll-inputs', week.start],
    queryFn: () => loadPayrollInputs(week, { excludePaidDates: true }),
    staleTime: 15 * 1000,
  });

  const { data: storedRecords = [], isLoading: loadingStored } = useQuery({
    queryKey: ['weekly-payroll', week.start],
    queryFn: () => getPayrollsForWeek(week.start),
  });

  const result = useMemo(
    () => (inputs ? computePayroll({ ...inputs, advanceSelections: selections }) : null),
    [inputs, selections]
  );

  const anomalies = useMemo(() => (result && inputs ? detectAnomalies(result, inputs.employees) : []), [result, inputs]);

  const toggleDeduction = useCallback((advanceId: string) => {
    // Flip the state the engine currently shows for this advance.
    setSelections((prev) => {
      const shown = result?.employees.flatMap((e) => e.advances).find((a) => a.id === advanceId)?.deduct ?? true;
      return { ...prev, [advanceId]: !shown };
    });
  }, [result]);
  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const generateMutation = useMutation({
    mutationFn: () =>
      generateWeeklyPayroll(
        week.start,
        { uid: profile!.uid, name: profile!.displayName || profile!.email, role: profile!.role as UserRole },
        selections
      ),
    onSuccess: (data) => {
      toast({
        title: 'Payroll approved',
        description: `${data.success} employees stored${data.skipped ? `, ${data.skipped} already existed` : ''}${data.failed ? `, ${data.failed} failed: ${data.errors.join('; ')}` : ''}`,
        variant: data.failed ? 'destructive' : undefined,
      });
      setConfirming(false);
      try { window.localStorage.removeItem(selectionKey(week.start)); } catch { /* ignore */ }
      setSelections({});
      queryClient.invalidateQueries({ queryKey: ['weekly-payroll'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-inputs'] });
      queryClient.invalidateQueries({ queryKey: ['advances'] });
    },
    onError: (error: unknown) => {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to generate payroll', variant: 'destructive' });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (payrollId: string) => markAsPaid(payrollId, 'cash', profile?.uid),
    onSuccess: () => {
      toast({ title: 'Marked as paid', description: 'Loan instalments recorded.' });
      queryClient.invalidateQueries({ queryKey: ['weekly-payroll'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-inputs'] });
    },
    onError: (error: unknown) => {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed', variant: 'destructive' });
    },
  });

  const filtered = (result?.employees || []).filter(
    (e) => !searchQuery || e.employeeName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const hasLegacyWeekRecords = storedRecords.some((r) => r.weekStartDate !== week.start);
  const pendingEmployees = result?.employees.length || 0;

  if (!isAuthorized) return null;

  return (
    <div className="space-y-6">
      {/* ========== WEEK SELECTOR ========== */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Payroll</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Weekly payroll · Monday–Saturday, plus emergency Sunday work when marked
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAnchorDate(addDaysISO(week.start, -7))} className="h-10 w-10 p-0" aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Week {getWeekNumber(fromISODateString(week.start))}</span>
            <span className="text-muted-foreground">
              {formatDate(week.start, 'EEE dd/MM/yyyy')} – {formatDate(week.end, 'EEE dd/MM/yyyy')}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setAnchorDate(addDaysISO(week.start, 7))} className="h-10 w-10 p-0" aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {week.start !== getPayrollWeek(todayISO()).start && (
            <Button variant="ghost" size="sm" onClick={() => setAnchorDate(todayISO())}>This week</Button>
          )}
        </div>
      </div>

      {inputsError && (
        <Card className="border-red-500/40 bg-red-500/10">
          <CardContent className="p-4 text-sm text-red-700 dark:text-red-300">Failed to load payroll data: {String((inputsError as Error).message || inputsError)}</CardContent>
        </Card>
      )}

      {loadingInputs || loadingStored || !result ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* ========== STATUS / ACTIONS ========== */}
          <Card>
            <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {storedRecords.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 font-medium text-green-700 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" /> {storedRecords.length} approved record{storedRecords.length === 1 ? '' : 's'}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 font-medium text-blue-700 dark:text-blue-400">
                  <Info className="h-4 w-4" /> Live preview: {pendingEmployees} employee{pendingEmployees === 1 ? '' : 's'} not yet approved
                </span>
              </div>
              {pendingEmployees > 0 && (
                confirming ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <span className="text-sm text-muted-foreground">
                      Approve {formatCurrency(result.totals.final)} for {pendingEmployees} employees? Ticked advances will be marked deducted.
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
                      <Button size="sm" className="gap-2" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                        {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        Approve &amp; store
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" className="gap-2" onClick={() => setConfirming(true)}>
                    <ShieldCheck className="h-4 w-4" /> Approve payroll
                  </Button>
                )
              )}
            </CardContent>
          </Card>

          {hasLegacyWeekRecords && (
            <p className="text-xs text-muted-foreground">
              Some stored records use the previous Sunday–Saturday week. Dates already paid in any stored record are excluded from this preview, so nothing is paid twice.
            </p>
          )}

          {/* ========== REVIEW FLAGS (never change pay) ========== */}
          {anomalies.length > 0 && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="p-3 sm:p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" /> {anomalies.length} item{anomalies.length === 1 ? '' : 's'} to review before approving
                </p>
                <ul className="space-y-1 text-xs text-foreground sm:text-sm">
                  {anomalies.slice(0, 12).map((a, i) => (
                    <li key={i} className="flex gap-2">
                      <span className={cn('shrink-0 rounded px-1.5 text-xs font-medium uppercase', a.severity === 'critical' ? 'bg-red-500/15 text-red-700 dark:text-red-300' : a.severity === 'warning' ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300' : 'bg-blue-500/15 text-blue-700 dark:text-blue-300')}>{a.severity}</span>
                      <span><strong>{a.employeeName}</strong>: {a.message}</span>
                    </li>
                  ))}
                  {anomalies.length > 12 && <li className="text-muted-foreground">…and {anomalies.length - 12} more (open each employee below)</li>}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* ========== OVERALL SUMMARY (preview) ========== */}
          {pendingEmployees > 0 && <PayrollOverview totals={result.totals} />}

          {/* ========== SITE SUMMARY ========== */}
          <SiteTotalsTable sites={result.sites} />

          {/* ========== EMPLOYEE SUMMARY ========== */}
          <div>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-foreground sm:text-lg">Employee payroll</h2>
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search employee…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 text-sm" />
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                {filtered.length === 0 ? (
                  <div className="flex h-32 items-center justify-center p-4 text-center text-sm text-muted-foreground">
                    {pendingEmployees === 0 ? 'No unpaid attendance in this week.' : 'No matching employees'}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filtered.map((e) => (
                      <WorkerPayrollCard
                        key={e.employeeId}
                        summary={e}
                        isExpanded={expanded.has(e.employeeId)}
                        onToggle={() => toggleExpanded(e.employeeId)}
                        onToggleDeduction={toggleDeduction}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ========== GRAND TOTAL ========== */}
          {pendingEmployees > 0 && <GrandTotalCard totals={result.totals} />}

          {/* ========== STORED (APPROVED) RECORDS ========== */}
          {storedRecords.length > 0 && (
            <StoredPayrollList
              records={storedRecords}
              expanded={expanded}
              onToggle={toggleExpanded}
              onMarkPaid={(id) => markPaidMutation.mutate(id)}
              markPaidPending={markPaidMutation.isPending}
            />
          )}
        </>
      )}
    </div>
  );
}

// =====================================================
// STORED PAYROLL RECORDS (approved / paid) — read-only snapshot
// =====================================================

function StoredPayrollList({
  records, expanded, onToggle, onMarkPaid, markPaidPending,
}: {
  records: WeeklyPayroll[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onMarkPaid: (id: string) => void;
  markPaidPending: boolean;
}) {
  const total = records.reduce((s, r) => s + (Number(r.netPay) || 0), 0);
  return (
    <div>
      <h2 className="mb-3 text-base font-semibold text-foreground sm:text-lg">Approved payroll records</h2>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {records.map((r) => {
              const isOpen = expanded.has(`stored-${r.id}`);
              return (
                <div key={r.id}>
                  <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onToggle(`stored-${r.id}`)} aria-expanded={isOpen}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{r.employeeName}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <RoleBadge role={(r.employeeRole || 'helper') as UserRole} />
                          <span className={cn('rounded-full px-2 py-0.5 font-medium capitalize', r.status === 'paid' ? 'bg-green-500/15 text-green-700 dark:text-green-300' : 'bg-blue-500/15 text-blue-700 dark:text-blue-300')}>{r.status}</span>
                          {r.weekStartDate !== records[0].weekStartDate && <span>legacy week</span>}
                        </div>
                      </div>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{formatCurrency(r.netPay)}</p>
                      {r.status !== 'paid' && (
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => onMarkPaid(r.id)} disabled={markPaidPending}>
                          <Wallet className="h-3.5 w-3.5" /> Mark paid
                        </Button>
                      )}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="space-y-2 border-t border-border bg-muted/20 p-3 text-xs sm:text-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[420px]">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th className="p-1.5 font-medium">Site</th><th className="p-1.5 text-right font-medium">Days/Visits</th>
                              <th className="p-1.5 text-right font-medium">OT h</th><th className="p-1.5 text-right font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(r.siteBreakdowns || []).map((sb) => (
                              <tr key={sb.siteId} className="border-t border-border/60">
                                <td className="p-1.5">{sb.siteName || sb.siteId}</td>
                                <td className="p-1.5 text-right">{(sb as { visits?: number }).visits || sb.daysWorked}</td>
                                <td className="p-1.5 text-right">{sb.otHours}</td>
                                <td className="p-1.5 text-right">{formatCurrency(sb.totalPay)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p>Gross {formatCurrency(r.totalEarnings)} (transport {formatCurrency(r.transportAllowance || 0)}) − advances {formatCurrency((r.advances || []).reduce((s, a) => s + a.amount, 0))} − loans {formatCurrency((r.loanDeductions || []).reduce((s, l) => s + l.emiAmount, 0))} = <strong>{formatCurrency(r.netPay)}</strong></p>
                      {(r.advances || []).length > 0 && (
                        <p className="text-muted-foreground">Advances deducted: {(r.advances || []).map((a) => `${formatCurrency(a.amount)}${(a as { date?: string }).date ? ` (${formatDate((a as { date?: string }).date!, 'dd/MM/yyyy')})` : ''}`).join(', ')}</p>
                      )}
                      {((r as { anomalies?: string[] }).anomalies || []).map((m) => (
                        <p key={m} className="flex items-center gap-1 text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3 w-3 shrink-0" /> {m}</p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between border-t border-border p-3 text-sm font-semibold text-foreground sm:p-4">
            <span>Approved total</span><span>{formatCurrency(total)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
