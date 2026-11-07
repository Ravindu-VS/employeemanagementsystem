'use client';

/**
 * =====================================================
 * TRANSPORT PAGE — vehicles, routes, passengers
 * =====================================================
 * Records company transport (vehicle ↔ driver ↔ route ↔ site ↔ passengers).
 * Transport ALLOWANCE for employees who travel on their own is set per
 * employee (rate type, distance) and by Settings → distance bands; the
 * payroll engine shows it as "Transport" on each payslip.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bus, Loader2, MapPin, Pencil, Plus, Route as RouteIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireRole } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/use-toast';
import { ACCESS_MATRIX } from '@/domain/roles';
import { findTransportBand, isTransportEligible } from '@/domain/transport';
import { getAllEmployees, getAllSites, getPayrollSettings, getTransportRoutes, getVehicles, saveTransportRoute, saveVehicle } from '@/services';
import { formatCurrency, cn } from '@/lib/utils';
import type { TransportRoute, Vehicle } from '@/types';

type VehicleForm = Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>;
type RouteForm = Omit<TransportRoute, 'id' | 'createdAt' | 'updatedAt'>;
const EMPTY_VEHICLE: VehicleForm = { registrationNo: '', type: 'van', capacity: 10, driverId: '', status: 'active', notes: '' };
const EMPTY_ROUTE: RouteForm = { name: '', vehicleId: '', driverId: '', siteId: '', pickupPoints: '', distanceKm: 0, passengerIds: [], status: 'active', notes: '' };
const selectCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export default function TransportPage() {
  const { isAuthorized } = useRequireRole(ACCESS_MATRIX.transport);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'routes' | 'vehicles'>('routes');
  const [vehicleForm, setVehicleForm] = useState<{ id?: string; data: VehicleForm } | null>(null);
  const [routeForm, setRouteForm] = useState<{ id?: string; data: RouteForm } | null>(null);

  const { data: vehicles = [], isLoading: lv } = useQuery({ queryKey: ['vehicles'], queryFn: getVehicles, enabled: isAuthorized });
  const { data: routes = [], isLoading: lr } = useQuery({ queryKey: ['transport-routes'], queryFn: getTransportRoutes, enabled: isAuthorized });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: getAllEmployees, enabled: isAuthorized });
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: getAllSites, enabled: isAuthorized });
  const { data: payrollSettings } = useQuery({ queryKey: ['payroll-settings'], queryFn: getPayrollSettings, enabled: isAuthorized });

  const drivers = useMemo(() => employees.filter((e) => e.role === 'driver' && e.isActive), [employees]);
  const activeStaff = useMemo(() => employees.filter((e) => e.isActive && e.role !== 'driver').sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')), [employees]);
  const name = (uid?: string) => employees.find((e) => e.uid === uid)?.displayName || '—';
  const siteName = (id?: string) => sites.find((s) => s.id === id)?.name || '—';
  const vehicleOf = (id?: string) => vehicles.find((v) => v.id === id);
  const onError = (e: unknown) => toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });

  const vehicleMutation = useMutation({
    mutationFn: (f: { id?: string; data: VehicleForm }) => saveVehicle(f.data, f.id),
    onSuccess: () => { toast({ title: 'Vehicle saved' }); setVehicleForm(null); queryClient.invalidateQueries({ queryKey: ['vehicles'] }); },
    onError,
  });
  const routeMutation = useMutation({
    mutationFn: (f: { id?: string; data: RouteForm }) => saveTransportRoute(f.data, f.id, vehicleOf(f.data.vehicleId)?.capacity),
    onSuccess: () => { toast({ title: 'Route saved' }); setRouteForm(null); queryClient.invalidateQueries({ queryKey: ['transport-routes'] }); },
    onError,
  });

  if (!isAuthorized) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Transport</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">Company vehicles, drivers and routes to sites. Allowances for self-travel are set per employee and in Settings.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === 'routes' ? 'default' : 'outline'} size="sm" onClick={() => setTab('routes')} className="gap-1"><RouteIcon className="h-4 w-4" /> Routes</Button>
          <Button variant={tab === 'vehicles' ? 'default' : 'outline'} size="sm" onClick={() => setTab('vehicles')} className="gap-1"><Bus className="h-4 w-4" /> Vehicles</Button>
        </div>
      </div>

      {tab === 'vehicles' && (
        <>
          {vehicleForm ? (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{vehicleForm.id ? 'Edit vehicle' : 'New vehicle'}</CardTitle></CardHeader>
              <CardContent>
                <form className="grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); vehicleMutation.mutate(vehicleForm); }}>
                  <Field label="Registration no."><Input value={vehicleForm.data.registrationNo} onChange={(e) => setVehicleForm({ ...vehicleForm, data: { ...vehicleForm.data, registrationNo: e.target.value } })} placeholder="WP CAB-1234" /></Field>
                  <Field label="Type">
                    <select className={selectCls} value={vehicleForm.data.type} onChange={(e) => setVehicleForm({ ...vehicleForm, data: { ...vehicleForm.data, type: e.target.value as Vehicle['type'] } })}>
                      {['van', 'bus', 'lorry', 'car', 'three_wheeler', 'other'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                    </select>
                  </Field>
                  <Field label="Seats"><Input type="number" min={1} value={vehicleForm.data.capacity} onChange={(e) => setVehicleForm({ ...vehicleForm, data: { ...vehicleForm.data, capacity: Math.max(1, Number(e.target.value) || 1) } })} /></Field>
                  <Field label="Driver">
                    <select className={selectCls} value={vehicleForm.data.driverId || ''} onChange={(e) => setVehicleForm({ ...vehicleForm, data: { ...vehicleForm.data, driverId: e.target.value } })}>
                      <option value="">— none —</option>
                      {drivers.map((d) => <option key={d.uid} value={d.uid}>{d.displayName}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select className={selectCls} value={vehicleForm.data.status} onChange={(e) => setVehicleForm({ ...vehicleForm, data: { ...vehicleForm.data, status: e.target.value as Vehicle['status'] } })}>
                      <option value="active">Active</option><option value="inactive">Inactive</option>
                    </select>
                  </Field>
                  <Field label="Notes"><Input value={vehicleForm.data.notes || ''} onChange={(e) => setVehicleForm({ ...vehicleForm, data: { ...vehicleForm.data, notes: e.target.value } })} /></Field>
                  <FormActions onCancel={() => setVehicleForm(null)} pending={vehicleMutation.isPending} />
                </form>
              </CardContent>
            </Card>
          ) : (
            <Button className="gap-1" onClick={() => setVehicleForm({ data: EMPTY_VEHICLE })}><Plus className="h-4 w-4" /> Add vehicle</Button>
          )}
          <Card>
            <CardContent className="p-0">
              {lv ? <Spinner /> : vehicles.length === 0 ? <Empty text="No vehicles yet" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3 font-medium">Vehicle</th><th className="p-3 font-medium">Type</th><th className="p-3 text-right font-medium">Seats</th><th className="p-3 font-medium">Driver</th><th className="p-3 font-medium">Status</th><th className="p-3" /></tr></thead>
                    <tbody>
                      {vehicles.map((v) => (
                        <tr key={v.id} className="border-b border-border/60">
                          <td className="p-3 font-medium text-foreground">{v.registrationNo}</td>
                          <td className="p-3 capitalize">{v.type.replace('_', ' ')}</td>
                          <td className="p-3 text-right">{v.capacity}</td>
                          <td className="p-3">{name(v.driverId)}</td>
                          <td className="p-3"><Status s={v.status} /></td>
                          <td className="p-3 text-right"><Button size="sm" variant="ghost" className="gap-1" onClick={() => setVehicleForm({ id: v.id, data: { registrationNo: v.registrationNo, type: v.type, capacity: v.capacity, driverId: v.driverId || '', status: v.status, notes: v.notes || '' } })}><Pencil className="h-3.5 w-3.5" /> Edit</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'routes' && (
        <>
          {routeForm ? (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{routeForm.id ? 'Edit route' : 'New route'}</CardTitle></CardHeader>
              <CardContent>
                <form className="grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); routeMutation.mutate(routeForm); }}>
                  <Field label="Route name"><Input value={routeForm.data.name} onChange={(e) => setRouteForm({ ...routeForm, data: { ...routeForm.data, name: e.target.value } })} placeholder="Kandy → Daminda site" /></Field>
                  <Field label="Site">
                    <select className={selectCls} value={routeForm.data.siteId || ''} onChange={(e) => setRouteForm({ ...routeForm, data: { ...routeForm.data, siteId: e.target.value } })}>
                      <option value="">— none —</option>
                      {sites.filter((s) => s.status !== 'archived').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Distance (km)"><Input type="number" min={0} step="0.1" value={routeForm.data.distanceKm} onChange={(e) => setRouteForm({ ...routeForm, data: { ...routeForm.data, distanceKm: Math.max(0, Number(e.target.value) || 0) } })} /></Field>
                  <Field label="Vehicle">
                    <select className={selectCls} value={routeForm.data.vehicleId || ''} onChange={(e) => { const v = vehicleOf(e.target.value); setRouteForm({ ...routeForm, data: { ...routeForm.data, vehicleId: e.target.value, driverId: routeForm.data.driverId || v?.driverId || '' } }); }}>
                      <option value="">— none —</option>
                      {vehicles.filter((v) => v.status === 'active').map((v) => <option key={v.id} value={v.id}>{v.registrationNo} ({v.capacity} seats)</option>)}
                    </select>
                  </Field>
                  <Field label="Driver">
                    <select className={selectCls} value={routeForm.data.driverId || ''} onChange={(e) => setRouteForm({ ...routeForm, data: { ...routeForm.data, driverId: e.target.value } })}>
                      <option value="">— none —</option>
                      {drivers.map((d) => <option key={d.uid} value={d.uid}>{d.displayName}</option>)}
                    </select>
                  </Field>
                  <Field label="Pick-up points"><Input value={routeForm.data.pickupPoints || ''} onChange={(e) => setRouteForm({ ...routeForm, data: { ...routeForm.data, pickupPoints: e.target.value } })} /></Field>
                  <div className="space-y-1 sm:col-span-3">
                    <Label>Passengers ({routeForm.data.passengerIds.length}{vehicleOf(routeForm.data.vehicleId) ? ` / ${vehicleOf(routeForm.data.vehicleId)!.capacity} seats` : ''})</Label>
                    <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2 lg:grid-cols-3">
                      {activeStaff.map((e) => {
                        const checked = routeForm.data.passengerIds.includes(e.uid);
                        return (
                          <label key={e.uid} className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded px-2 text-sm hover:bg-muted/50">
                            <input type="checkbox" className="h-4 w-4 accent-primary" checked={checked} onChange={() => setRouteForm({ ...routeForm, data: { ...routeForm.data, passengerIds: checked ? routeForm.data.passengerIds.filter((x) => x !== e.uid) : [...routeForm.data.passengerIds, e.uid] } })} />
                            <span className="truncate">{e.displayName}</span>
                            {isTransportEligible(e) && <span className="ml-auto shrink-0 text-xs text-amber-700 dark:text-amber-400" title="This employee also receives a travel allowance">allowance</span>}
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">Passengers marked “allowance” are also set to receive a travel allowance — set their transport type to Company vehicle if they ride this route.</p>
                  </div>
                  <Field label="Status">
                    <select className={selectCls} value={routeForm.data.status} onChange={(e) => setRouteForm({ ...routeForm, data: { ...routeForm.data, status: e.target.value as TransportRoute['status'] } })}>
                      <option value="active">Active</option><option value="inactive">Inactive</option>
                    </select>
                  </Field>
                  <Field label="Notes"><Input value={routeForm.data.notes || ''} onChange={(e) => setRouteForm({ ...routeForm, data: { ...routeForm.data, notes: e.target.value } })} /></Field>
                  <FormActions onCancel={() => setRouteForm(null)} pending={routeMutation.isPending} />
                </form>
              </CardContent>
            </Card>
          ) : (
            <Button className="gap-1" onClick={() => setRouteForm({ data: EMPTY_ROUTE })}><Plus className="h-4 w-4" /> Add route</Button>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {lr ? <Spinner /> : routes.length === 0 ? <Card><CardContent><Empty text="No routes yet" /></CardContent></Card> : routes.map((r) => {
              const band = findTransportBand(payrollSettings?.transportBands, r.distanceKm);
              return (
                <Card key={r.id}>
                  <CardContent className="space-y-2 p-4 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{r.name}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {siteName(r.siteId)} · {r.distanceKm} km</p>
                      </div>
                      <Status s={r.status} />
                    </div>
                    <p>Vehicle: {vehicleOf(r.vehicleId)?.registrationNo || '—'} · Driver: {name(r.driverId)}</p>
                    <p>Passengers ({r.passengerIds.length}): <span className="text-muted-foreground">{r.passengerIds.map(name).join(', ') || '—'}</span></p>
                    {band && <p className="text-xs text-muted-foreground">Distance band for this route: {band.label || `${band.minKm}–${band.maxKm ?? '∞'} km`} · {formatCurrency(band.ratePerDay)}/day</p>}
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => setRouteForm({ id: r.id, data: { name: r.name, vehicleId: r.vehicleId || '', driverId: r.driverId || '', siteId: r.siteId || '', pickupPoints: r.pickupPoints || '', distanceKm: r.distanceKm, passengerIds: r.passengerIds || [], status: r.status, notes: r.notes || '' } })}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}
function FormActions({ onCancel, pending }: { onCancel: () => void; pending: boolean }) {
  return (
    <div className="flex justify-end gap-2 sm:col-span-3">
      <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      <Button type="submit" disabled={pending} className="gap-2">{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
    </div>
  );
}
function Status({ s }: { s: 'active' | 'inactive' }) {
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', s === 'active' ? 'bg-green-500/15 text-green-700 dark:text-green-300' : 'bg-slate-500/15 text-slate-700 dark:text-slate-300')}>{s}</span>;
}
function Spinner() {
  return <div className="flex h-24 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}
function Empty({ text }: { text: string }) {
  return <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">{text}</div>;
}
