'use client';

/**
 * =====================================================
 * ASSETS — tools, equipment, safety gear, IT
 * =====================================================
 * Register assets, assign them to an employee and/or site, take them back,
 * send them for maintenance or retire them. Every change is kept in the
 * asset's history and in the audit log.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Package, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { Empty, Field, FormActions, PageHeader, Pill, Spinner, errorText, selectCls, selectInlineCls, type Tone } from '@/components/dashboard/page-bits';
import { ACCESS_MATRIX } from '@/domain/roles';
import { changeAsset, createAsset, getAllEmployees, getAllSites, getAssets, type NewAsset } from '@/services';
import { formatCurrency } from '@/lib/utils';
import type { Asset, AssetCategory, AssetStatus } from '@/types';
import type { AssetAction } from '@/domain/assets';

const CATEGORIES: AssetCategory[] = ['tool', 'equipment', 'vehicle', 'safety', 'it', 'other'];
const STATUS_TONE: Record<AssetStatus, Tone> = { available: 'green', assigned: 'blue', maintenance: 'amber', retired: 'slate' };
const EMPTY: NewAsset = { assetTag: '', name: '', category: 'tool', condition: 'good', serialNo: '', purchaseDate: '' };

export default function AssetsPage() {
  const { isAuthorized, profile } = useRequireRole(ACCESS_MATRIX.assets);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<NewAsset | null>(null);
  const [assignFor, setAssignFor] = useState<{ asset: Asset; employeeId: string; siteId: string } | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all');

  const { data: assets = [], isLoading } = useQuery({ queryKey: ['assets'], queryFn: getAssets, enabled: isAuthorized });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: getAllEmployees, enabled: isAuthorized });
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: getAllSites, enabled: isAuthorized });
  const empName = (id?: string | null) => employees.find((e) => e.uid === id)?.displayName || '';
  const siteName = (id?: string | null) => sites.find((s) => s.id === id)?.name || '';
  const onError = (e: unknown) => toast({ title: 'Error', description: errorText(e), variant: 'destructive' });
  const done = () => qc.invalidateQueries({ queryKey: ['assets'] });

  const create = useMutation({
    mutationFn: (f: NewAsset) => createAsset(f, profile?.uid || 'unknown', assets.map((a) => a.assetTag)),
    onSuccess: () => { toast({ title: 'Asset added' }); setForm(null); done(); },
    onError,
  });
  const act = useMutation({
    mutationFn: ({ asset, action }: { asset: Asset; action: AssetAction }) => changeAsset(asset, action, profile?.uid || 'unknown'),
    onSuccess: () => { setAssignFor(null); done(); },
    onError,
  });

  const shown = useMemo(() => assets.filter((a) => (statusFilter === 'all' || a.status === statusFilter) && `${a.assetTag} ${a.name} ${a.serialNo || ''} ${empName(a.assignedToEmployeeId)} ${siteName(a.assignedSiteId)}`.toLowerCase().includes(q.toLowerCase())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assets, q, statusFilter, employees, sites]);
  const counts = useMemo(() => ({ total: assets.length, assigned: assets.filter((a) => a.status === 'assigned').length, maintenance: assets.filter((a) => a.status === 'maintenance').length, value: assets.filter((a) => a.status !== 'retired').reduce((s, a) => s + (a.purchaseCost || 0), 0) }), [assets]);

  if (!isAuthorized) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Assets" subtitle="Tools, equipment and safety gear — who has what, and where.">
        <Button className="gap-1" onClick={() => setForm(EMPTY)}><Plus className="h-4 w-4" /> Add asset</Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Assets', counts.total], ['Assigned', counts.assigned], ['In maintenance', counts.maintenance], ['Value (excl. retired)', formatCurrency(counts.value)]].map(([l, v]) => (
          <Card key={l as string}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-lg font-bold text-foreground">{v}</p></CardContent></Card>
        ))}
      </div>

      {form && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">New asset</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}>
              <Field label="Asset tag"><Input value={form.assetTag} onChange={(e) => setForm({ ...form, assetTag: e.target.value })} placeholder="KK-T-001" /></Field>
              <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Concrete mixer" /></Field>
              <Field label="Category">
                <select className={selectCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as AssetCategory })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c === 'it' ? 'IT' : c}</option>)}
                </select>
              </Field>
              <Field label="Serial no."><Input value={form.serialNo || ''} onChange={(e) => setForm({ ...form, serialNo: e.target.value })} /></Field>
              <Field label="Purchase date"><Input type="date" value={form.purchaseDate || ''} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} /></Field>
              <Field label="Cost (LKR)"><Input type="number" min={0} value={form.purchaseCost ?? ''} onChange={(e) => setForm({ ...form, purchaseCost: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })} /></Field>
              <Field label="Condition">
                <select className={selectCls} value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value as Asset['condition'] })}>
                  {['good', 'fair', 'poor', 'damaged'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <FormActions onCancel={() => setForm(null)} pending={create.isPending} className="items-end sm:col-span-2" />
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tag, name, person or site" /></div>
        <select className={`${selectInlineCls} w-full sm:w-44`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AssetStatus | 'all')}>
          <option value="all">All statuses</option>{(['available', 'assigned', 'maintenance', 'retired'] as AssetStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <Spinner /> : shown.length === 0 ? <Empty text={assets.length ? 'No assets match' : 'No assets yet'} /> : (
            <ul className="divide-y divide-border">
              {shown.map((a) => (
                <li key={a.id} className="p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <Package className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{a.assetTag} · {a.name}</p>
                        <p className="text-xs capitalize text-muted-foreground">{a.category === 'it' ? 'IT' : a.category} · {a.condition}{a.purchaseCost ? ` · ${formatCurrency(a.purchaseCost)}` : ''}{a.status === 'assigned' ? ` · with ${[empName(a.assignedToEmployeeId), siteName(a.assignedSiteId)].filter(Boolean).join(' @ ')}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={STATUS_TONE[a.status]}>{a.status}</Pill>
                      {a.status === 'available' && <Button size="sm" variant="outline" onClick={() => setAssignFor({ asset: a, employeeId: '', siteId: '' })}>Assign</Button>}
                      {a.status === 'assigned' && <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ asset: a, action: { type: 'return' } })}>Return</Button>}
                      {a.status === 'maintenance' && <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ asset: a, action: { type: 'available' } })}>Back in service</Button>}
                      {a.status !== 'retired' && a.status !== 'maintenance' && <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => act.mutate({ asset: a, action: { type: 'maintenance' } })}>Maintenance</Button>}
                      {a.status !== 'retired' && <Button size="sm" variant="ghost" className="text-red-600" disabled={act.isPending} onClick={() => act.mutate({ asset: a, action: { type: 'retire' } })}>Retire</Button>}
                      <Button size="sm" variant="ghost" className="gap-1" onClick={() => setHistoryFor(historyFor === a.id ? null : a.id)}><History className="h-3.5 w-3.5" /> History</Button>
                    </div>
                  </div>
                  {assignFor?.asset.id === a.id && (
                    <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); act.mutate({ asset: a, action: { type: 'assign', employeeId: assignFor.employeeId || undefined, siteId: assignFor.siteId || undefined } }); }}>
                      <select className={selectCls} value={assignFor.employeeId} onChange={(e) => setAssignFor({ ...assignFor, employeeId: e.target.value })}>
                        <option value="">— employee —</option>{employees.filter((e) => e.isActive).map((e) => <option key={e.uid} value={e.uid}>{e.displayName}</option>)}
                      </select>
                      <select className={selectCls} value={assignFor.siteId} onChange={(e) => setAssignFor({ ...assignFor, siteId: e.target.value })}>
                        <option value="">— site —</option>{sites.filter((s) => s.status === 'active').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <FormActions onCancel={() => setAssignFor(null)} pending={act.isPending} label="Assign" className="" />
                    </form>
                  )}
                  {historyFor === a.id && (
                    <ol className="mt-3 space-y-1 border-l border-border pl-4 text-xs text-muted-foreground">
                      {[...a.history].reverse().map((h, i) => (
                        <li key={i}><span className="font-medium capitalize text-foreground">{h.action}</span> · {new Date(h.at).toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })} · by {empName(h.by) || h.by}{h.employeeId ? ` · to ${empName(h.employeeId)}` : ''}{h.siteId ? ` @ ${siteName(h.siteId)}` : ''}{h.note ? ` · ${h.note}` : ''}</li>
                      ))}
                    </ol>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
