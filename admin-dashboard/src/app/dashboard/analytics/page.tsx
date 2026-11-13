'use client';

/**
 * =====================================================
 * WORKFORCE ANALYTICS
 * =====================================================
 * Every number comes from the payroll engine (earnings only), so it matches
 * Payroll and Reports exactly.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Table2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireRole } from '@/components/providers/auth-provider';
import { Empty, PageHeader, Spinner, selectInlineCls, useVizColors } from '@/components/dashboard/page-bits';
import { ACCESS_MATRIX } from '@/domain/roles';
import { buildWorkforceAnalytics, lastWeeks } from '@/domain/analytics';
import { loadPayrollInputs } from '@/services';
import { todayISO } from '@/lib/date-utils';
import { formatCurrency } from '@/lib/utils';
import { ROLE_OPTIONS } from '@/constants';

const roleLabel = (r: string) => ROLE_OPTIONS.find((o) => o.value === r)?.label || r;
const short = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

function ChartTip({ active, payload, label, money }: { active?: boolean; payload?: Array<{ value: number }>; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm">
      <p className="font-medium">Week of {label}</p>
      <p>{money ? formatCurrency(payload[0].value) : `${payload[0].value} h`}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { isAuthorized } = useRequireRole(ACCESS_MATRIX.analytics);
  const viz = useVizColors();
  const axis = { stroke: viz.axis, tick: { fill: viz.axis, fontSize: 12 }, tickLine: false, axisLine: false } as const;
  const [count, setCount] = useState(8);
  const [asTable, setAsTable] = useState(false);
  const weeks = useMemo(() => lastWeeks(todayISO(), count), [count]);

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', weeks[0].start, weeks[weeks.length - 1].end],
    queryFn: async () => {
      const inputs = await loadPayrollInputs({ start: weeks[0].start, end: weeks[weeks.length - 1].end }, { includeDeductions: false });
      return buildWorkforceAnalytics(inputs, weeks);
    },
    enabled: isAuthorized,
  });

  if (!isAuthorized) return null;
  const maxRole = Math.max(1, ...(data?.headcountByRole.map((r) => r.count) || [1]));

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Headcount, earnings, overtime and site utilisation — from the same engine as Payroll.">
        <select aria-label="Period" className={`${selectInlineCls} w-40`} value={count} onChange={(e) => setCount(Number(e.target.value))}>
          <option value={4}>Last 4 weeks</option><option value={8}>Last 8 weeks</option><option value={13}>Last 13 weeks</option><option value={26}>Last 26 weeks</option>
        </select>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => setAsTable(!asTable)}>{asTable ? <><BarChart3 className="h-4 w-4" /> Charts</> : <><Table2 className="h-4 w-4" /> Table</>}</Button>
      </PageHeader>

      {isLoading || !data ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Active employees', String(data.activeHeadcount), `${data.inactiveHeadcount} inactive`],
              ['Earnings in period', formatCurrency(data.totals.gross), `${count} weeks`],
              ['Overtime pay', formatCurrency(data.totals.otPay), `${Math.round(data.totals.otHours * 10) / 10} OT hours`],
              ['Average daily salary', formatCurrency(data.averageDailyRate), 'active staff'],
            ].map(([l, v, s]) => (
              <Card key={l}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-lg font-bold text-foreground sm:text-2xl">{v}</p><p className="text-xs text-muted-foreground">{s}</p></CardContent></Card>
            ))}
          </div>

          {asTable ? (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">By week</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[640px] text-sm">
                  <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3 font-medium">Week</th><th className="p-3 text-right font-medium">People</th><th className="p-3 text-right font-medium">Days</th><th className="p-3 text-right font-medium">Visits</th><th className="p-3 text-right font-medium">OT h</th><th className="p-3 text-right font-medium">Normal</th><th className="p-3 text-right font-medium">OT pay</th><th className="p-3 text-right font-medium">Earnings</th></tr></thead>
                  <tbody>{data.weeks.map((w) => (
                    <tr key={w.start} className="border-b border-border/60 tabular-nums"><td className="p-3">{w.label}</td><td className="p-3 text-right">{w.peopleWorked}</td><td className="p-3 text-right">{w.days}</td><td className="p-3 text-right">{w.visits}</td><td className="p-3 text-right">{w.otHours}</td><td className="p-3 text-right">{formatCurrency(w.normalPay)}</td><td className="p-3 text-right">{formatCurrency(w.otPay)}</td><td className="p-3 text-right font-medium">{formatCurrency(w.gross)}</td></tr>
                  ))}</tbody>
                </table>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-0"><CardTitle className="text-base">Weekly earnings (LKR)</CardTitle></CardHeader>
                <CardContent className="h-64 p-2 sm:p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.weeks} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={viz.grid} vertical={false} />
                      <XAxis dataKey="label" {...axis} />
                      <YAxis tickFormatter={short} width={44} {...axis} />
                      <Tooltip content={<ChartTip money />} cursor={{ stroke: viz.axis, strokeDasharray: '3 3' }} />
                      <Line type="monotone" dataKey="gross" stroke={viz.series} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: viz.surface, fill: viz.series }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-0"><CardTitle className="text-base">Overtime hours per week</CardTitle></CardHeader>
                <CardContent className="h-64 p-2 sm:p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.weeks} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid stroke={viz.grid} vertical={false} />
                      <XAxis dataKey="label" {...axis} />
                      <YAxis width={36} allowDecimals={false} {...axis} />
                      <Tooltip content={<ChartTip />} cursor={{ fill: viz.grid, opacity: 0.5 }} />
                      <Bar dataKey="otHours" fill={viz.series} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Headcount by role</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.headcountByRole.length === 0 ? <Empty text="No active employees" /> : data.headcountByRole.map((r) => (
                  <div key={r.role} className="grid grid-cols-[120px_1fr_32px] items-center gap-2 text-sm">
                    <span className="truncate text-muted-foreground">{roleLabel(r.role)}</span>
                    <div className="h-3 rounded-full bg-muted"><div className="h-3 rounded-full" style={{ width: `${(r.count / maxRole) * 100}%`, background: viz.series }} /></div>
                    <span className="text-right font-medium tabular-nums text-foreground">{r.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Most overtime</CardTitle></CardHeader>
              <CardContent className="p-0">
                {data.topOvertime.length === 0 ? <Empty text="No overtime in this period" /> : (
                  <table className="w-full text-sm"><tbody>{data.topOvertime.map((e) => (
                    <tr key={e.employeeId} className="border-b border-border/60 tabular-nums"><td className="p-3 text-foreground">{e.name}</td><td className="p-3 text-right">{e.otHours} h</td><td className="p-3 text-right">{formatCurrency(e.otPay)}</td></tr>
                  ))}</tbody></table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Site utilisation</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {data.sites.length === 0 ? <Empty text="No site work in this period" /> : (
                <table className="w-full min-w-[560px] text-sm">
                  <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="p-3 font-medium">Site</th><th className="p-3 text-right font-medium">Worker-days</th><th className="p-3 text-right font-medium">Visits</th><th className="p-3 text-right font-medium">OT h</th><th className="p-3 text-right font-medium">Avg people / week</th><th className="p-3 text-right font-medium">Labour cost</th></tr></thead>
                  <tbody>{data.sites.map((s) => (
                    <tr key={s.siteId} className="border-b border-border/60 tabular-nums"><td className="p-3 text-foreground">{s.siteName}</td><td className="p-3 text-right">{s.days}</td><td className="p-3 text-right">{s.visits}</td><td className="p-3 text-right">{s.otHours}</td><td className="p-3 text-right">{s.avgPeoplePerWeek}</td><td className="p-3 text-right font-medium">{formatCurrency(s.total)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
