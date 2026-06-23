'use client';

/**
 * =====================================================
 * WORKER PAYROLL CARD (Live Preview)
 * =====================================================
 * Collapsible card showing worker payroll summary with
 * advance deduction controls.
 *
 * States:
 * - Collapsed: Name, role, days, final salary
 * - Expanded: Site breakdown, advances with deduction checkboxes, final salary
 */

import {
  ChevronDown,
  ChevronUp,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { type SiteBreakdown, type UserRole } from '@/types';

interface EmployeeWeekSummary {
  employeeId: string;
  employeeName: string;
  employeeRole: UserRole;
  daysWorked: number;
  otHours: number;
  grossPay: number;
  dailyRate: number;
  otRate: number;
  siteBreakdowns: SiteBreakdown[];
  advances: any[];
}

interface WorkerPayrollCardProps {
  summary: EmployeeWeekSummary;
  isExpanded: boolean;
  onToggle: () => void;
  deductionSelections: Record<string, boolean>;
  onToggleDeduction: (advanceId: string) => void;
  showPreview: boolean;
}

const roleBadgeColors: Record<UserRole, string> = {
  owner: 'bg-purple-500/20 text-purple-400',
  ceo: 'bg-blue-500/20 text-blue-400',
  manager: 'bg-cyan-500/20 text-cyan-400',
  supervisor: 'bg-green-500/20 text-green-400',
  draughtsman: 'bg-yellow-500/20 text-yellow-400',
  bass: 'bg-orange-500/20 text-orange-400',
  helper: 'bg-gray-500/20 text-gray-400',
};

export function WorkerPayrollCard({
  summary,
  isExpanded,
  onToggle,
  deductionSelections,
  onToggleDeduction,
  showPreview,
}: WorkerPayrollCardProps) {
  // DEBUG: Early log before accessing summary.advances
  if (typeof window !== 'undefined') {
    console.log(`🔍 [WORKER CARD RENDER START] ${summary.employeeName}, advances exists: ${!!summary.advances}, type: ${typeof summary.advances}`);
  }

  // Safely handle advances - default to empty array if undefined
  const advances = summary.advances || [];

  // Calculate advance deduction for this worker based on checkbox state
  const advanceDeduction = advances.reduce(
    (sum, adv) => sum + (deductionSelections[adv.id] ? adv.amount : 0),
    0
  );
  const finalSalary = summary.grossPay - advanceDeduction;

  // Count advances being deducted
  const advancesSelected = advances.filter(adv => deductionSelections[adv.id]).length;

  return (
    <div className={cn(
      'transition-colors',
      advanceDeduction > 0
        ? 'border-l-4 border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10'
        : advances.length > 0
          ? 'border-l-4 border-red-500/30 hover:bg-muted/20'
          : 'hover:bg-muted/20'
    )}>
      {/* Collapsed summary row */}
      <div className="flex w-full items-center justify-between gap-2 p-3 sm:p-4 text-left">
        {/* Left side: name, role, days */}
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1"
        >
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 font-medium text-primary text-xs sm:text-sm">
            {summary.employeeName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-xs sm:text-sm truncate">{summary.employeeName}</p>
            <div className="flex items-center gap-1.5 sm:gap-2 max-w-sm text-xs flex-wrap">
              <span className={cn(
                'inline-flex shrink-0 rounded-full px-1.5 sm:px-2 py-0.5 font-medium',
                roleBadgeColors[summary.employeeRole]
              )}>
                {summary.employeeRole}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatCurrency(summary.dailyRate)}/day
              </span>
              {summary.siteBreakdowns.length > 1 && (
                <span className="rounded bg-blue-500/20 px-1 py-0.5 text-xs text-blue-400 whitespace-nowrap">
                  {summary.siteBreakdowns.length} sites
                </span>
              )}
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {summary.daysWorked}d{summary.otHours > 0 ? `+${summary.otHours.toFixed(1)}h` : ''}
              </span>
              {advances.length > 0 && (
                <span className={cn(
                  'inline-flex shrink-0 rounded px-1.5 py-0.5 text-xs font-medium',
                  advanceDeduction > 0
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                )}>
                  {advances.length} Advance{advances.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </button>

        {/* Right side: deduction, final salary, expand button */}
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 sm:gap-3 shrink-0"
        >
          <div className="text-right">
            {advanceDeduction > 0 && (
              <p className="text-xs font-bold text-red-500 whitespace-nowrap">
                -{formatCurrency(advanceDeduction)}
              </p>
            )}
            <p className="text-sm sm:text-lg font-bold text-green-500 whitespace-nowrap">
              {formatCurrency(finalSalary)}
            </p>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
          )}
        </button>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-border/30 bg-muted/10 px-4 pb-4">

          {/* Site breakdown */}
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Site Breakdown
            </p>
            <div className="rounded-lg border border-border/50 overflow-x-auto">
              <table className="w-full text-xs sm:text-sm min-w-max">
                <thead>
                  <tr className="bg-muted/30 text-left">
                    <th className="p-2 sm:p-2.5 font-medium text-muted-foreground">Site</th>
                    <th className="p-2 sm:p-2.5 text-center font-medium text-muted-foreground">Days</th>
                    <th className="p-2 sm:p-2.5 text-center font-medium text-muted-foreground">OT</th>
                    <th className="p-2 sm:p-2.5 text-right font-medium text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.siteBreakdowns.map((sb) => (
                    <tr key={sb.siteId} className="border-t border-border/30">
                      <td className="p-2 sm:p-2.5">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{sb.siteName}</span>
                        </div>
                      </td>
                      <td className="p-2 sm:p-2.5 text-center whitespace-nowrap">{sb.daysWorked}</td>
                      <td className="p-2 sm:p-2.5 text-center whitespace-nowrap">
                        {sb.otHours > 0 ? (
                          <span className="text-orange-500">{sb.otHours.toFixed(1)}h</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-2 sm:p-2.5 text-right font-medium whitespace-nowrap">{formatCurrency(sb.totalPay)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30 font-bold">
                    <td className="p-2 sm:p-2.5">Total</td>
                    <td className="p-2 sm:p-2.5 text-center whitespace-nowrap">{summary.daysWorked.toFixed(1)}</td>
                    <td className="p-2 sm:p-2.5 text-center whitespace-nowrap">
                      {summary.otHours > 0 ? `${summary.otHours.toFixed(1)}h` : '-'}
                    </td>
                    <td className="p-2 sm:p-2.5 text-right text-blue-500 whitespace-nowrap">
                      {formatCurrency(summary.grossPay)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Gross salary */}
          <div className="mt-3 flex items-center justify-between rounded-lg bg-blue-500/5 border border-blue-500/20 px-4 py-2">
            <span className="text-sm font-medium">Gross Salary</span>
            <span className="font-bold text-blue-500">{formatCurrency(summary.grossPay)}</span>
          </div>

          {/* Advances section */}
          {advances.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Advances ({advances.length})
              </p>
              <div className="space-y-2">
                {advances.map((adv) => (
                  <div
                    key={adv.id}
                    className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-xs sm:text-sm">
                          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                          <span className="font-medium text-red-400">
                            {formatCurrency(adv.amount)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground ml-6">
                          {adv.date
                            ? new Date(adv.date).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
                            : '-'}
                          {adv.reason ? ` - ${adv.reason}` : ''}
                        </p>
                      </div>

                      {/* Deduct checkbox - CEO control */}
                      {(showPreview || !showPreview) && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={deductionSelections[adv.id] || false}
                            onChange={(e) => {
                              e.stopPropagation();
                              onToggleDeduction(adv.id);
                            }}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          />
                          <span className="text-xs font-medium whitespace-nowrap">
                            Deduct This Week
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Advance Deduction Total - NEW */}
              {advanceDeduction > 0 && (
                <div className="mt-2.5 rounded-lg bg-red-500/5 border border-red-500/20 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-medium text-red-400">Advance Deduction Total</span>
                    <span className="text-sm font-bold text-red-400">{formatCurrency(advanceDeduction)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground italic">No pending advances</p>
          )}

          {/* Final salary - highlighted */}
          <div className="mt-3 flex items-center justify-between rounded-lg bg-green-500/10 border-2 border-green-500/30 px-4 py-3">
            <span className="font-semibold">Final Salary</span>
            <div className="text-right">
              {advanceDeduction > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(summary.grossPay)} - {formatCurrency(advanceDeduction)}
                </p>
              )}
              <span className="text-xl font-bold text-green-500">
                {formatCurrency(finalSalary)}
              </span>
            </div>
          </div>

          {advanceDeduction === 0 && summary.advances.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground italic">
              Advance will carry forward to next week
            </p>
          )}
        </div>
      )}
    </div>
  );
}
