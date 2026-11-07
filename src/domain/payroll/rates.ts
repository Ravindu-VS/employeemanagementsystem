/**
 * =====================================================
 * PAYROLL RATE RULES
 * =====================================================
 * OT hourly rate = daily salary ÷ 8 (never a stored, editable value).
 * The full weekly calculation lives in ./engine.ts.
 */

import { PAYROLL_CONFIG } from '@/constants';
import type { SalaryHistoryEntry, UserProfile } from '@/types';

export function calculateOtRate(dailyRate: number): number {
  if (!dailyRate || dailyRate < 0) return 0;
  return dailyRate / PAYROLL_CONFIG.OT_DAILY_DIVISOR;
}

export function calculateOtPay(dailyRate: number, otHours: number): number {
  if (!dailyRate || !otHours || dailyRate < 0 || otHours < 0) return 0;
  return calculateOtRate(dailyRate) * otHours;
}

/**
 * Daily salary applicable on a calendar date: the latest salary-history entry
 * effective on or before the date, otherwise the employee's current rate.
 */
export function dailyRateOn(
  employee: Pick<UserProfile, 'dailyRate'> & { salaryHistory?: SalaryHistoryEntry[] },
  date: string
): number {
  const history = (employee.salaryHistory || [])
    .filter((h) => h && h.effectiveFrom && Number.isFinite(Number(h.dailyRate)))
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  let rate: number | undefined;
  for (const h of history) {
    if (h.effectiveFrom <= date) rate = Number(h.dailyRate);
  }
  if (rate === undefined) {
    // Date precedes all history entries: use the earliest known rate when the
    // history exists (the current rate may be a later raise).
    rate = history.length > 0 ? Number(history[0].dailyRate) : Number(employee.dailyRate) || 0;
  }
  return rate > 0 ? rate : 0;
}

