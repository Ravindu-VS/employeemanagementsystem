/**
 * =====================================================
 * ADVANCE RULES (single authoritative implementation)
 * =====================================================
 * Requested → Approved / Rejected. Only approved, not-yet-deducted advances
 * dated on/before the payroll week end are available for deduction.
 * The payroll administrator ticks "Deduct this week"; unticked advances stay
 * outstanding and are offered again next week (carry forward) until deducted.
 */

import { toISODateString } from '@/lib/date-utils';
import type { AdvanceRequest } from '@/types';

/** Legacy documents used either `deducted` or `isDeducted`. */
export function isAdvanceDeducted(a: Partial<AdvanceRequest> & { deducted?: boolean }): boolean {
  return a.isDeducted === true || a.deducted === true;
}

/** Advance date (yyyy-MM-dd, Colombo). */
export function advanceDate(a: Partial<AdvanceRequest> & { advanceDate?: string; date?: string }): string {
  const raw = a.advanceDate || a.date || a.requestedAt || a.createdAt;
  return raw ? toISODateString(raw as Date | string) : '';
}

export function isAdvanceOutstanding(a: AdvanceRequest): boolean {
  return a.status === 'approved' && !isAdvanceDeducted(a);
}

/** Available for deduction in the payroll week ending `weekEnd`. */
export function isAdvanceAvailableForWeek(a: AdvanceRequest, weekEnd: string): boolean {
  const d = advanceDate(a);
  return isAdvanceOutstanding(a) && (!d || d <= weekEnd);
}

/**
 * Advance page grouping for a week:
 * - thisWeek: approved & outstanding, dated inside the week
 * - carryForward: approved & outstanding, dated before the week
 * - deductedThisWeek: deducted in this week's payroll
 */
export function groupWeeklyAdvances(
  advances: AdvanceRequest[],
  weekStart: string,
  weekEnd: string
): { thisWeek: AdvanceRequest[]; carryForward: AdvanceRequest[]; deductedThisWeek: AdvanceRequest[] } {
  const thisWeek: AdvanceRequest[] = [];
  const carryForward: AdvanceRequest[] = [];
  const deductedThisWeek: AdvanceRequest[] = [];
  for (const a of advances) {
    const d = advanceDate(a);
    if (isAdvanceOutstanding(a)) {
      if (d >= weekStart && d <= weekEnd) thisWeek.push(a);
      else if (d < weekStart) carryForward.push(a);
    } else if (a.status === 'approved' && isAdvanceDeducted(a)) {
      const wk = a.deductedWeek || a.deductionWeekId;
      if (wk && wk >= weekStart && wk <= weekEnd) deductedThisWeek.push(a);
    }
  }
  return { thisWeek, carryForward, deductedThisWeek };
}
