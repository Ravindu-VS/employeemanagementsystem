/**
 * =====================================================
 * LEAVE RULES
 * =====================================================
 * Request → Manager/CEO/Owner approval → balance updated → notification.
 * Working days are Monday–Saturday (Sunday is the weekly holiday).
 * Leave is unpaid for daily-wage staff: payroll pays attendance only, so an
 * approved leave never adds or removes pay by itself.
 */

import { dayOfWeekISO, eachDateISO } from '@/lib/date-utils';
import type { LeaveRequest, LeaveSettings, LeaveType } from '@/types';

export const DEFAULT_LEAVE_SETTINGS: LeaveSettings = { annualDays: 14, sickDays: 7, casualDays: 7 };

export function countLeaveDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate || endDate < startDate) return 0;
  return eachDateISO(startDate, endDate).filter((d) => dayOfWeekISO(d) !== 0).length;
}

export interface LeaveBalance {
  type: Exclude<LeaveType, 'unpaid'>;
  entitlement: number;
  used: number;
  pending: number;
  remaining: number;
}

/** Balance for one employee for a calendar year (yyyy). */
export function computeLeaveBalances(requests: LeaveRequest[], year: string, settings: LeaveSettings = DEFAULT_LEAVE_SETTINGS): LeaveBalance[] {
  const entitlement: Record<LeaveBalance['type'], number> = { annual: settings.annualDays, sick: settings.sickDays, casual: settings.casualDays };
  return (Object.keys(entitlement) as LeaveBalance['type'][]).map((type) => {
    const inYear = requests.filter((r) => r.type === type && r.startDate.startsWith(year));
    const used = inYear.filter((r) => r.status === 'approved').reduce((s, r) => s + r.days, 0);
    const pending = inYear.filter((r) => r.status === 'pending').reduce((s, r) => s + r.days, 0);
    return { type, entitlement: entitlement[type], used, pending, remaining: entitlement[type] - used };
  });
}

/** Validation for a new request (returns an error message or null). */
export function validateLeaveRequest(
  req: { type: LeaveType; startDate: string; endDate: string },
  existing: LeaveRequest[],
  settings: LeaveSettings = DEFAULT_LEAVE_SETTINGS
): string | null {
  if (!req.startDate || !req.endDate) return 'Select start and end dates';
  if (req.endDate < req.startDate) return 'End date is before start date';
  const days = countLeaveDays(req.startDate, req.endDate);
  if (days === 0) return 'The selected range has no working days (Mon–Sat)';
  const overlap = existing.find((r) => (r.status === 'pending' || r.status === 'approved') && r.startDate <= req.endDate && r.endDate >= req.startDate);
  if (overlap) return `Overlaps an existing ${overlap.status} leave (${overlap.startDate} – ${overlap.endDate})`;
  if (req.type !== 'unpaid') {
    const bal = computeLeaveBalances(existing, req.startDate.slice(0, 4), settings).find((b) => b.type === req.type)!;
    if (days > bal.remaining - bal.pending) return `Only ${Math.max(0, bal.remaining - bal.pending)} ${req.type} day(s) left this year`;
  }
  return null;
}

/** Approved leave covering a date (for the attendance screen). */
export function leaveOnDate(requests: LeaveRequest[], employeeId: string, date: string): LeaveRequest | undefined {
  return requests.find((r) => r.employeeId === employeeId && r.status === 'approved' && r.startDate <= date && r.endDate >= date);
}
