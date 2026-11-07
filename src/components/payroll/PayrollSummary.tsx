'use client';

/**
 * =====================================================
 * PAYROLL SUMMARY — overall totals + site totals
 * =====================================================
 * Displays PayrollEngineResult.totals and .sites. No calculation here.
 * Grand total identity shown to the user:
 *   Site totals + Driver duty + Transport = Gross
 *   Gross − Advances − Loans = Final payroll
 */

import { Building2, Users, Clock, Truck, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, cn } from '@/lib/utils';
import type { PayrollTotals, SitePayrollTotal } from '@/domain/payroll';

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function PayrollOverview({ totals }: { totals: PayrollTotals }) {
  const items = [
    { label: 'Employees', value: String(totals.employees), icon: Users },
    { label: 'Total days', value: `${num(totals.days)}${totals.visits ? ` + ${totals.visits} visits` : ''}`, icon: Clock },
    { label: 'Total OT', value: `${num(totals.otHours)} h`, icon: Clock },
    { label: 'Gross', value: formatCurrency(totals.gross), icon: Wallet },
    { label: 'Transport', value: formatCurrency(totals.transport), icon: Truck },
    { label: 'Advances', value: `− ${formatCurrency(totals.advances)}`, icon: Wallet },
    { label: 'Loans', value: `− ${formatCurrency(totals.loans)}`, icon: Wallet },
    { label: 'Final payroll', value: formatCurrency(totals.final), icon: Wallet, strong: true },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label} className={cn(it.strong && 'border-primary/50 bg-primary/5')}>
          <CardContent className="p-3 sm:p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><it.icon className="h-3.5 w-3.5" /> {it.label}</p>
            <p className={cn('mt-1 truncate text-base font-bold text-foreground sm:text-lg', it.strong && 'text-primary')}>{it.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function SiteTotalsTable({ sites }: { sites: SitePayrollTotal[] }) {
  if (sites.length === 0) return null;
  const total = sites.reduce((s, x) => s + x.total, 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" /> Site summary</CardTitle>
      </CardHeader>
      <CardContent className="p-0 sm:p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Site</th>
                <th className="p-3 text-right font-medium">Employees</th>
                <th className="p-3 text-right font-medium">Days</th>
                <th className="p-3 text-right font-medium">Visits</th>
                <th className="p-3 text-right font-medium">OT h</th>
                <th className="p-3 text-right font-medium">Site salary</th>
                <th className="p-3 text-right font-medium">OT pay</th>
                <th className="p-3 text-right font-medium">Site total</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.siteId} className="border-b border-border/60">
                  <td className="p-3 font-medium text-foreground">{s.siteName}</td>
                  <td className="p-3 text-right">{s.employeeCount}</td>
                  <td className="p-3 text-right">{num(s.days)}</td>
                  <td className="p-3 text-right">{s.visits}</td>
                  <td className="p-3 text-right">{num(s.otHours)}</td>
                  <td className="p-3 text-right">{formatCurrency(s.normalPay)}</td>
                  <td className="p-3 text-right">{formatCurrency(s.otPay)}</td>
                  <td className="p-3 text-right font-semibold text-foreground">{formatCurrency(s.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-foreground">
                <td className="p-3" colSpan={7}>All sites grand total</td>
                <td className="p-3 text-right">{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function GrandTotalCard({ totals }: { totals: PayrollTotals }) {
  const rows: Array<[string, number, 'plus' | 'minus' | 'eq']> = [
    ['All sites (labor + supervisor)', totals.siteTotal, 'plus'],
    ['Driver duty', totals.driverTotal, 'plus'],
    ['Transport', totals.transport, 'plus'],
    ['Gross payroll', totals.gross, 'eq'],
    ['Advance deductions', totals.advances, 'minus'],
    ['Loan deductions', totals.loans, 'minus'],
  ];
  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Grand total — all employees, all sites</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-1 text-sm">
          {rows.map(([label, v, kind]) => (
            <div key={label} className={cn('flex justify-between gap-3', kind === 'eq' && 'border-t border-border pt-1 font-semibold text-foreground')}>
              <dt>{kind === 'minus' ? '− ' : kind === 'plus' ? '+ ' : ''}{label}</dt>
              <dd className={cn('tabular-nums', kind === 'minus' && v > 0 && 'text-red-600 dark:text-red-400')}>{formatCurrency(v)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t-2 border-primary/40 pt-2 text-lg font-bold text-primary">
            <dt>= Final payroll</dt>
            <dd className="tabular-nums">{formatCurrency(totals.final)}</dd>
          </div>
          {totals.carriedForward > 0 && (
            <p className="pt-1 text-xs text-muted-foreground">Advances carried forward (not deducted this week): {formatCurrency(totals.carriedForward)}</p>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
