/**
 * =====================================================
 * WORKFORCE ANALYTICS
 * =====================================================
 * Runs the ONE payroll engine week by week (earnings only, no deductions),
 * so every figure here matches Payroll and Reports exactly.
 */

import { computePayroll, type PayrollEngineInput } from '@/domain/payroll';
import { addDaysISO, getPayrollWeek } from '@/lib/date-utils';
import type { UserRole } from '@/types';

export interface WeekPoint {
  start: string;
  end: string;
  label: string; // dd/MM
  peopleWorked: number;
  days: number;
  visits: number;
  otHours: number;
  normalPay: number;
  otPay: number;
  gross: number;
  otShare: number; // % of gross
}

export interface SiteUtilisation {
  siteId: string;
  siteName: string;
  days: number;
  visits: number;
  otHours: number;
  total: number;
  avgPeoplePerWeek: number;
}

export interface WorkforceAnalytics {
  weeks: WeekPoint[];
  sites: SiteUtilisation[];
  headcountByRole: Array<{ role: UserRole; count: number }>;
  activeHeadcount: number;
  inactiveHeadcount: number;
  averageDailyRate: number;
  topOvertime: Array<{ employeeId: string; name: string; otHours: number; otPay: number }>;
  totals: { gross: number; otPay: number; otHours: number; days: number };
}

/** The last `count` Mon–Sun payroll weeks ending with the week containing `today`. */
export function lastWeeks(today: string, count: number): Array<{ start: string; end: string }> {
  const cur = getPayrollWeek(today);
  return Array.from({ length: count }, (_, i) => {
    const start = addDaysISO(cur.start, -7 * (count - 1 - i));
    return { start, end: addDaysISO(start, 6) };
  });
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function buildWorkforceAnalytics(input: Omit<PayrollEngineInput, 'period'>, weeks: Array<{ start: string; end: string }>): WorkforceAnalytics {
  const siteAcc = new Map<string, SiteUtilisation & { peopleWeeks: number }>();
  const otAcc = new Map<string, { employeeId: string; name: string; otHours: number; otPay: number }>();

  const points: WeekPoint[] = weeks.map((w) => {
    const r = computePayroll({ ...input, period: w, includeDeductions: false, advances: [], loans: [] });
    for (const s of r.sites) {
      const a = siteAcc.get(s.siteId) || { siteId: s.siteId, siteName: s.siteName, days: 0, visits: 0, otHours: 0, total: 0, avgPeoplePerWeek: 0, peopleWeeks: 0 };
      a.days += s.days; a.visits += s.visits; a.otHours += s.otHours; a.total += s.total; a.peopleWeeks += s.employeeCount;
      siteAcc.set(s.siteId, a);
    }
    for (const e of r.employees) {
      if (!e.otHours) continue;
      const a = otAcc.get(e.employeeId) || { employeeId: e.employeeId, name: e.employeeName, otHours: 0, otPay: 0 };
      a.otHours += e.otHours; a.otPay += e.otPay;
      otAcc.set(e.employeeId, a);
    }
    const t = r.totals;
    return {
      start: w.start, end: w.end, label: ddmm(w.start),
      peopleWorked: r.employees.filter((e) => e.daysWorked > 0 || e.visits > 0).length,
      days: t.days, visits: t.visits, otHours: t.otHours,
      normalPay: t.normalPay, otPay: t.otPay, gross: t.normalPay + t.otPay,
      otShare: t.normalPay + t.otPay > 0 ? round2((t.otPay / (t.normalPay + t.otPay)) * 100) : 0,
    };
  });

  const roles = new Map<UserRole, number>();
  const active = input.employees.filter((e) => e.isActive);
  for (const e of active) if (e.role) roles.set(e.role, (roles.get(e.role) || 0) + 1);
  const rated = active.filter((e) => (e.dailyRate || 0) > 0);

  return {
    weeks: points,
    sites: Array.from(siteAcc.values())
      .map(({ peopleWeeks, ...s }) => ({ ...s, days: round2(s.days), otHours: round2(s.otHours), total: round2(s.total), avgPeoplePerWeek: weeks.length ? round2(peopleWeeks / weeks.length) : 0 }))
      .sort((a, b) => b.total - a.total),
    headcountByRole: Array.from(roles.entries()).map(([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count),
    activeHeadcount: active.length,
    inactiveHeadcount: input.employees.length - active.length,
    averageDailyRate: rated.length ? Math.round(rated.reduce((s, e) => s + (e.dailyRate || 0), 0) / rated.length) : 0,
    topOvertime: Array.from(otAcc.values()).sort((a, b) => b.otHours - a.otHours).slice(0, 5),
    totals: points.reduce((s, p) => ({ gross: s.gross + p.gross, otPay: s.otPay + p.otPay, otHours: s.otHours + p.otHours, days: s.days + p.days }), { gross: 0, otPay: 0, otHours: 0, days: 0 }),
  };
}
