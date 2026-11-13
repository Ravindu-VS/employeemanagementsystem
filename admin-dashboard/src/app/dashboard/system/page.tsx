'use client';

/**
 * =====================================================
 * SYSTEM — health, client errors, legacy data migration
 * =====================================================
 */

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, CircleSlash, DatabaseZap, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { Empty, PageHeader, Pill, Spinner, errorText } from '@/components/dashboard/page-bits';
import { ACCESS_MATRIX } from '@/domain/roles';
import { getRecentClientErrors, planAttendanceMigration, runAttendanceMigration, runHealthChecks } from '@/services';
import type { MigrationPlan } from '@/domain/attendance/migration';

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export default function SystemPage() {
  const { isAuthorized, profile } = useRequireRole(ACCESS_MATRIX.system);
  const { toast } = useToast();
  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [confirm, setConfirm] = useState(false);

  const health = useQuery({ queryKey: ['health'], queryFn: runHealthChecks, enabled: isAuthorized });
  const errors = useQuery({ queryKey: ['client-errors'], queryFn: () => getRecentClientErrors(100), enabled: isAuthorized });
  const dry = useMutation({ mutationFn: () => planAttendanceMigration(), onSuccess: (p) => { setPlan(p); setConfirm(false); }, onError: (e) => toast({ title: 'Error', description: errorText(e), variant: 'destructive' }) });
  const run = useMutation({
    mutationFn: () => runAttendanceMigration(plan!, profile!.uid),
    onSuccess: (r) => { toast({ title: 'Migration complete', description: `${r.written} documents written, ${r.superseded} old documents flagged superseded (none deleted).` }); setPlan(null); setConfirm(false); },
    onError: (e) => toast({ title: 'Migration failed', description: errorText(e), variant: 'destructive' }),
  });

  if (!isAuthorized) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="System" subtitle={`Health, recorded errors and data maintenance · version ${process.env.NEXT_PUBLIC_APP_VERSION || 'dev'}`}>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => { health.refetch(); errors.refetch(); }}><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </PageHeader>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Health</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {health.isLoading ? <Spinner /> : (health.data || []).map((h) => (
            <div key={h.name} className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                {h.ok === true ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : h.ok === false ? <XCircle className="h-5 w-5 text-red-600" /> : <CircleSlash className="h-5 w-5 text-muted-foreground" />}
                <div><p className="text-sm font-medium text-foreground">{h.name}</p><p className="text-xs text-muted-foreground">{h.detail}</p></div>
              </div>
              {h.ms !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{h.ms} ms</span>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><DatabaseZap className="h-4 w-4" /> Legacy attendance migration (one-off)</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">Folds old random-ID attendance documents into one document per worker per day. Old documents are only flagged “superseded” — nothing is deleted, and pay stays exactly the same. Run the check first.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={dry.isPending} onClick={() => dry.mutate()}>{dry.isPending ? 'Checking…' : 'Check (dry run)'}</Button>
            {plan && plan.items.length > 0 && !confirm && <Button onClick={() => setConfirm(true)}>Migrate {plan.items.length} worker-days…</Button>}
            {confirm && (
              <>
                <Button variant="destructive" disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? 'Migrating…' : `Yes, write ${plan!.items.length} documents`}</Button>
                <Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
              </>
            )}
          </div>
          {plan && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Pill>{plan.documentsScanned} documents scanned</Pill>
                <Pill tone={plan.legacyDocuments ? 'amber' : 'green'}>{plan.legacyDocuments} legacy documents</Pill>
                <Pill tone="green">{plan.alreadyClean} worker-days already clean</Pill>
              </div>
              {plan.items.length === 0 ? <p className="text-green-700 dark:text-green-400">Nothing to migrate — all attendance is in the current format.</p> : (
                <div className="max-h-72 overflow-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card"><tr className="border-b border-border text-left text-muted-foreground"><th className="p-2">Date</th><th className="p-2">Worker</th><th className="p-2">Type</th><th className="p-2">New document</th><th className="p-2 text-right">Old docs</th></tr></thead>
                    <tbody>{plan.items.slice(0, 500).map((i) => (
                      <tr key={i.targetId} className="border-b border-border/60"><td className="p-2">{dmy(i.date)}</td><td className="p-2">{String(i.data.workerName || i.workerId)}</td><td className="p-2 capitalize">{i.kind}</td><td className="p-2 font-mono">{i.targetId}</td><td className="p-2 text-right">{i.supersede.length}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Recent client errors</CardTitle></CardHeader>
        <CardContent className="p-0">
          {errors.isLoading ? <Spinner /> : errors.error ? <Empty text={errorText(errors.error)} /> : !errors.data?.length ? <Empty text="No errors recorded" /> : (
            <ul className="divide-y divide-border text-sm">
              {errors.data.map((e) => (
                <li key={e.id} className="p-3">
                  <p className="break-words font-medium text-foreground">{e.message}</p>
                  <p className="text-xs text-muted-foreground">{e.createdAt.toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })} · {e.url} · v{e.appVersion}</p>
                  {e.stack && <details className="mt-1 text-xs"><summary className="cursor-pointer text-muted-foreground">Stack</summary><pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-muted p-2">{e.stack}</pre></details>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
