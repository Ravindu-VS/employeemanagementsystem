'use client';

/**
 * =====================================================
 * WORKER PAYROLL CARD
 * =====================================================
 * Renders ONE employee's result from the payroll engine. No calculation
 * happens here — every number comes from EmployeePayroll.
 *
 * Collapsed: name, role, days/visits, final salary
 * Expanded : Site | Days | OT | Normal | OT pay | Total
 *            → Gross → Advances (Date | Amount | Reason | Status | Deduct?)
 *            → Loans → Transport → Final salary
 */

import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { formatDate } from '@/lib/date-utils';
import { DRIVER_DUTY_LINE_ID, type EmployeePayroll } from '@/domain/payroll';
import { RoleBadge } from './RoleBadge';

interface WorkerPayrollCardProps {
  summary: EmployeePayroll;
  isExpanded: boolean;
  onToggle: () => void;
  /** Advance deduction checkbox (omit for read-only views) */
  onToggleDeduction?: (advanceId: string) => void;
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function WorkerPayrollCard({ summary: e, isExpanded, onToggle, onToggleDeduction }: WorkerPayrollCardProps) {
  const isVisitModel = e.sites.some((s) => s.payModel === 'site_visit');
  const workLabel = isVisitModel ? `${e.visits} site visit${e.visits === 1 ? '' : 's'}` : `${num(e.daysWorked)} day${e.daysWorked === 1 ? '' : 's'}`;

  return (
    <div className={cn('transition-colors hover:bg-muted/30', e.totalDeductions > 0 && 'border-l-4 border-amber-500/60')}>
      <button type="button" onClick={onToggle} aria-expanded={isExpanded} className="flex w-full items-center justify-between gap-3 p-3 sm:p-4 text-left">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary">
            {e.employeeName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {e.employeeName}
              {!e.isActive && <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <RoleBadge role={e.role} />
              <span>{workLabel}</span>
              {e.otHours > 0 && <span>· {num(e.otHours)}h OT</span>}
              {e.sites.filter((s) => s.siteId !== DRIVER_DUTY_LINE_ID).length > 1 && (
                <span>· {e.sites.filter((s) => s.siteId !== DRIVER_DUTY_LINE_ID).length} sites</span>
              )}
              {e.anomalies.length > 0 && (
                <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" /> {e.anomalies.length}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <p className="text-sm font-bold text-foreground sm:text-base">{formatCurrency(e.finalSalary)}</p>
            {e.totalDeductions > 0 && (
              <p className="text-xs text-muted-foreground line-through">{formatCurrency(e.gross)}</p>
            )}
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {isExpanded && (
        <div className="space-y-4 border-t border-border bg-muted/20 px-3 pb-4 pt-3 sm:px-4">
          {/* Rates */}
          <p className="text-xs text-muted-foreground">
            Daily salary {formatCurrency(e.dailyRate)} · OT rate {formatCurrency(e.otRate)}/h (daily ÷ 8)
            {e.siteVisitRate !== undefined && <> · Site visit {formatCurrency(e.siteVisitRate)}</>}
          </p>

          {/* Site breakdown */}
          <div className="overflow-x-auto rounded-md border border-border bg-background">
            <table className="w-full min-w-[520px] text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-2 font-medium">Site</th>
                  <th className="p-2 text-right font-medium">{isVisitModel ? 'Visits' : 'Days'}</th>
                  <th className="p-2 text-right font-medium">OT h</th>
                  <th className="p-2 text-right font-medium">Normal</th>
                  <th className="p-2 text-right font-medium">OT pay</th>
                  <th className="p-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {e.sites.map((l) => (
                  <tr key={l.siteId} className="border-b border-border/60 last:border-0">
                    <td className="p-2 text-foreground">{l.siteName}</td>
                    <td className="p-2 text-right">{l.payModel === 'site_visit' ? l.visits : num(l.days)}</td>
                    <td className="p-2 text-right">{num(l.otHours)}</td>
                    <td className="p-2 text-right">{formatCurrency(l.normalPay)}</td>
                    <td className="p-2 text-right">{formatCurrency(l.otPay)}</td>
                    <td className="p-2 text-right font-medium text-foreground">{formatCurrency(l.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold text-foreground">
                  <td className="p-2">Employee total</td>
                  <td className="p-2 text-right">{isVisitModel ? e.visits : num(e.daysWorked)}</td>
                  <td className="p-2 text-right">{num(e.otHours)}</td>
                  <td className="p-2 text-right">{formatCurrency(e.normalPay)}</td>
                  <td className="p-2 text-right">{formatCurrency(e.otPay)}</td>
                  <td className="p-2 text-right">{formatCurrency(e.normalPay + e.otPay)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Advances */}
          {e.advances.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Advances</p>
              <div className="overflow-x-auto rounded-md border border-border bg-background">
                <table className="w-full min-w-[480px] text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="p-2 font-medium">Date</th>
                      <th className="p-2 text-right font-medium">Amount</th>
                      <th className="p-2 font-medium">Reason</th>
                      <th className="p-2 font-medium">Status</th>
                      <th className="p-2 text-center font-medium">Deduct this week?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.advances.map((a) => (
                      <tr key={a.id} className="border-b border-border/60 last:border-0">
                        <td className="p-2">{a.date ? formatDate(a.date, 'EEE dd/MM/yyyy') : '—'}</td>
                        <td className="p-2 text-right">{formatCurrency(a.amount)}</td>
                        <td className="p-2">{a.reason || '—'}</td>
                        <td className="p-2 capitalize">{a.status}</td>
                        <td className="p-2 text-center">
                          {onToggleDeduction ? (
                            <label className="inline-flex cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                className="h-5 w-5 accent-primary"
                                checked={a.deduct}
                                onChange={() => onToggleDeduction(a.id)}
                                aria-label={`Deduct advance of ${a.amount}`}
                              />
                              <span className={cn('text-xs', a.deduct ? 'text-foreground' : 'text-amber-700 dark:text-amber-400')}>
                                {a.deduct ? 'Deduct' : 'Carry forward'}
                              </span>
                            </label>
                          ) : (
                            <span>{a.deduct ? 'Deducted' : 'Carried forward'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totals ladder */}
          <dl className="space-y-1 rounded-md border border-border bg-background p-3 text-sm">
            <Row label="Site / duty earnings" value={formatCurrency(e.normalPay)} />
            <Row label="OT earnings" value={formatCurrency(e.otPay)} />
            <Row label={`Transport${e.transportBasis ? ` (${e.transportBasis})` : ''}`} value={formatCurrency(e.transport)} />
            <Row label="Gross salary" value={formatCurrency(e.gross)} strong />
            <Row label="− Advance deduction" value={formatCurrency(e.advanceDeduction)} negative={e.advanceDeduction > 0} />
            {e.advanceCarriedForward > 0 && <Row label="  Carried forward to next week" value={formatCurrency(e.advanceCarriedForward)} muted />}
            {e.loans.map((l) => (
              <Row key={l.loanId} label={`− Loan instalment ${l.emiNumber}${l.totalEmis ? `/${l.totalEmis}` : ''} (balance after: ${formatCurrency(l.remainingAfter)})`} value={formatCurrency(l.amount)} negative />
            ))}
            {e.loans.length === 0 && <Row label="− Loan deduction" value={formatCurrency(0)} />}
            <Row label="Total deductions" value={formatCurrency(e.totalDeductions)} />
            <div className="my-1 border-t border-border" />
            <Row label="Final salary" value={formatCurrency(e.finalSalary)} strong />
          </dl>

          {e.anomalies.length > 0 && (
            <ul className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
              {e.anomalies.map((m) => (
                <li key={m} className="flex gap-1"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {m}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong, negative, muted }: { label: string; value: string; strong?: boolean; negative?: boolean; muted?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3', strong && 'font-semibold text-foreground', muted && 'text-xs text-muted-foreground')}>
      <dt className="min-w-0">{label}</dt>
      <dd className={cn('shrink-0 tabular-nums', negative && 'text-red-600 dark:text-red-400')}>{value}</dd>
    </div>
  );
}
