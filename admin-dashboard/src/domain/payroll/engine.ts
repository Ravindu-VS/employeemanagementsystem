/**
 * =====================================================
 * PAYROLL ENGINE — the ONLY payroll calculation in the app
 * =====================================================
 * Pure function: raw attendance + employees + advances + loans + settings
 * → per-employee, per-site and grand totals for one period (payroll week or
 * a report range). The payroll page, stored payroll generation, reports and
 * dashboard all consume this output; none of them recompute pay.
 *
 * Rules (see docs/README.md → Payroll engine):
 *  - Only attendance dated inside the period counts.
 *  - Labor (Draughtsman, Bass, Helper): morning = 0.5 day, evening = 0.5 day,
 *    per site. Morning Site A + evening Site B = 0.5 + 0.5.
 *  - Supervisor: each distinct site visited on a date = 1 visit, paid at the
 *    site-visit rate (employee.siteVisitRate → settings → 2,000 LKR).
 *    Owner/CEO/Manager: per-visit too, at siteVisitRate or their daily rate.
 *  - Driver duty (no site): morning = 0.5 day, evening = 0.5 day at the
 *    daily salary. Never site payroll.
 *  - OT pay = OT hours × (daily salary applicable on that date ÷ 8), counted
 *    only at the site (or driver duty) where it was recorded.
 *  - The current role decides the model (a Helper promoted to Supervisor is
 *    paid as Supervisor from now on).
 *  - Gross = site pay + driver pay + OT + transport.
 *    Final = Gross − selected advance deductions − loan instalments.
 */

import { PAYROLL_CONFIG } from '@/constants';
import { normalizeAttendance, type ShiftAllocation, type OtAllocation } from '@/domain/attendance';
import { isHigherRoleMultiSite } from '@/domain/roles';
import { advanceDate, isAdvanceAvailableForWeek } from '@/domain/advances';
import { calculateTransportAllowance } from '@/domain/transport';
import { calculateOtRate, dailyRateOn } from './rates';
import type { AdvanceRequest, Loan, SimpleAttendance, TransportBand, UserProfile, UserRole } from '@/types';

// -----------------------------------------------------
// Types
// -----------------------------------------------------

export type PayModel = 'labor' | 'site_visit' | 'driver';

export interface PayrollEngineInput {
  period: { start: string; end: string };
  attendance: SimpleAttendance[];
  /** ALL employees (active and inactive) so history is never dropped. */
  employees: UserProfile[];
  sites: Array<{ id: string; name: string }>;
  /** Outstanding advances (may include others; engine filters). */
  advances?: AdvanceRequest[];
  /** advanceId → false to carry forward. Missing = deduct this week. */
  advanceSelections?: Record<string, boolean>;
  /** Active loans. */
  loans?: Loan[];
  settings?: {
    supervisorSiteVisitRate?: number;
    transportBands?: TransportBand[];
    /** Default state of "Deduct this week" for advances (default true). */
    autoDeductAdvances?: boolean;
    /** Deduct active loan instalments (default true). */
    autoDeductLoans?: boolean;
  };
  /**
   * Dates already paid by an existing stored payroll, per employee uid
   * (protects against double payment across legacy/new week boundaries).
   */
  excludeDates?: Map<string, Set<string>>;
  /** Include advances/loans (week payroll) or not (pure earnings reports). */
  includeDeductions?: boolean;
}

export interface SitePayLine {
  siteId: string;
  siteName: string;
  payModel: PayModel;
  days: number;      // labor/driver day fractions (0.5 steps)
  visits: number;    // supervisor site visits
  otHours: number;
  normalPay: number;
  otPay: number;
  total: number;
}

export interface AdvanceLine {
  id: string;
  date: string;
  amount: number;
  reason: string;
  status: string;
  deduct: boolean;
}

export interface LoanLine {
  loanId: string;
  emiNumber: number;
  totalEmis: number;
  amount: number;
  remainingAfter: number;
}

export interface EmployeePayroll {
  employeeId: string;   // Firebase uid (stable)
  workerId: string;     // display / attendance worker id
  employeeName: string;
  role: UserRole;
  isActive: boolean;
  dailyRate: number;    // current daily salary
  otRate: number;       // dailyRate ÷ 8
  siteVisitRate?: number;
  sites: SitePayLine[]; // site lines (+ a driver-duty line when applicable)
  daysWorked: number;
  visits: number;
  otHours: number;
  normalPay: number;
  otPay: number;
  transport: number;
  transportBasis: string;
  gross: number;
  advances: AdvanceLine[];
  advanceDeduction: number;
  advanceCarriedForward: number;
  loans: LoanLine[];
  loanDeduction: number;
  totalDeductions: number;
  finalSalary: number;
  anomalies: string[];
}

export interface SitePayrollTotal {
  siteId: string;
  siteName: string;
  employeeCount: number;
  days: number;
  visits: number;
  otHours: number;
  normalPay: number;
  otPay: number;
  total: number;
}

export interface PayrollTotals {
  employees: number;
  days: number;
  visits: number;
  otHours: number;
  normalPay: number;
  otPay: number;
  siteTotal: number;   // all site lines (labor + supervisor)
  driverTotal: number; // driver duty lines
  transport: number;
  gross: number;
  advances: number;
  carriedForward: number;
  loans: number;
  deductions: number;
  final: number;
}

export interface PayrollEngineResult {
  period: { start: string; end: string };
  employees: EmployeePayroll[];
  sites: SitePayrollTotal[];
  totals: PayrollTotals;
  anomalies: Array<{ employeeId: string; employeeName: string; message: string }>;
}

export const DRIVER_DUTY_LINE_ID = 'driver_duty';
export const DRIVER_DUTY_LINE_NAME = 'Driver duty';

const round2 = (n: number) => Math.round(n * 100) / 100;

function matchesEmployee(emp: UserProfile, id: string | undefined): boolean {
  return !!id && (id === emp.uid || (!!emp.workerId && id === emp.workerId) || (emp.formerWorkerIds || []).includes(id));
}

// -----------------------------------------------------
// Engine
// -----------------------------------------------------

export function computePayroll(input: PayrollEngineInput): PayrollEngineResult {
  const { period } = input;
  const includeDeductions = input.includeDeductions !== false;
  const siteName = new Map(input.sites.map((s) => [s.id, s.name]));
  const visitRateDefault = Number(input.settings?.supervisorSiteVisitRate) || PAYROLL_CONFIG.DEFAULT_SUPERVISOR_SITE_VISIT_RATE;

  // Employee lookup by uid AND workerId (attendance stores workerId).
  const byId = new Map<string, UserProfile>();
  for (const e of input.employees) {
    byId.set(e.uid, e);
    for (const old of e.formerWorkerIds || []) if (!byId.has(old)) byId.set(old, e);
  }
  for (const e of input.employees) if (e.workerId) byId.set(e.workerId, e);

  const normalized = normalizeAttendance(input.attendance, period);

  // Group allocations by employee uid.
  type Bucket = { emp: UserProfile; shifts: ShiftAllocation[]; ot: OtAllocation[]; anomalies: string[] };
  const buckets = new Map<string, Bucket>();
  const bucketFor = (workerId: string, workerName: string): Bucket => {
    let emp = byId.get(workerId);
    if (!emp) {
      // Employee document missing (deleted): keep the history visible.
      emp = { uid: workerId, workerId, displayName: workerName, email: '', role: 'helper', dailyRate: 0, isActive: false } as UserProfile;
      byId.set(workerId, emp);
    }
    let b = buckets.get(emp.uid);
    if (!b) {
      b = { emp, shifts: [], ot: [], anomalies: [] };
      if (!input.employees.includes(emp)) b.anomalies.push('Employee record not found — paid at 0 daily salary');
      buckets.set(emp.uid, b);
    }
    return b;
  };

  for (const s of normalized.shifts) {
    const b = bucketFor(s.workerId, s.workerName);
    if (input.excludeDates?.get(b.emp.uid)?.has(s.date)) continue;
    b.shifts.push(s);
  }
  for (const o of normalized.ot) {
    const b = bucketFor(o.workerId, o.workerName);
    if (input.excludeDates?.get(b.emp.uid)?.has(o.date)) continue;
    b.ot.push(o);
  }
  for (const a of normalized.anomalies) {
    const b = bucketFor(a.workerId, a.workerId);
    b.anomalies.push(`${a.date}: ${a.message}`);
  }

  const employees: EmployeePayroll[] = [];

  for (const { emp, shifts, ot, anomalies } of buckets.values()) {
    if (shifts.length === 0 && ot.length === 0) continue;
    const role = (emp.role || 'helper') as UserRole;
    const multiSite = isHigherRoleMultiSite(role);
    const siteVisitRate = Number(emp.siteVisitRate) > 0
      ? Number(emp.siteVisitRate)
      : role === 'supervisor' ? visitRateDefault : undefined;

    const lines = new Map<string, SitePayLine>();
    const lineFor = (id: string, model: PayModel): SitePayLine => {
      let l = lines.get(id);
      if (!l) {
        l = {
          siteId: id,
          siteName: id === DRIVER_DUTY_LINE_ID ? DRIVER_DUTY_LINE_NAME : siteName.get(id) || id,
          payModel: model, days: 0, visits: 0, otHours: 0, normalPay: 0, otPay: 0, total: 0,
        };
        lines.set(id, l);
      }
      return l;
    };

    // ---- Driver duty --------------------------------
    const driverShifts = shifts.filter((s) => s.kind === 'driver');
    for (const s of driverShifts) {
      const l = lineFor(DRIVER_DUTY_LINE_ID, 'driver');
      l.days += 0.5;
      l.normalPay += 0.5 * dailyRateOn(emp, s.date);
    }

    // ---- Site shifts --------------------------------
    const siteShifts = shifts.filter((s) => s.kind === 'site' && s.siteId);
    if (multiSite) {
      // One visit per distinct (date, site), however many shifts/visits.
      const visits = new Map<string, ShiftAllocation>();
      for (const s of siteShifts) visits.set(`${s.date}|${s.siteId}`, s);
      for (const s of visits.values()) {
        const l = lineFor(s.siteId!, 'site_visit');
        l.visits += 1;
        l.normalPay += siteVisitRate !== undefined ? siteVisitRate : dailyRateOn(emp, s.date);
      }
    } else {
      // Labor: at most one site per (date, shift). Conflicting legacy
      // duplicates resolve to the most recently updated document.
      const perShift = new Map<string, ShiftAllocation>();
      for (const s of siteShifts) {
        const shiftNames = s.shift === 'visit' ? (['morning', 'evening'] as const) : [s.shift];
        if (s.shift === 'visit') anomalies.push(`${s.date}: site-visit record at ${siteName.get(s.siteId!) || s.siteId} counted as a full day (current role ${role})`);
        for (const sh of shiftNames) {
          const key = `${s.date}|${sh}`;
          const prev = perShift.get(key);
          if (prev && prev.siteId !== s.siteId) {
            anomalies.push(`${s.date}: ${sh} marked at two sites (${siteName.get(prev.siteId!) || prev.siteId} and ${siteName.get(s.siteId!) || s.siteId}) — latest kept`);
          }
          if (!prev || s.updatedAtMs > prev.updatedAtMs) perShift.set(key, { ...s, shift: sh });
        }
      }
      for (const s of perShift.values()) {
        const l = lineFor(s.siteId!, 'labor');
        l.days += 0.5;
        l.normalPay += 0.5 * dailyRateOn(emp, s.date);
      }
    }

    // ---- OT (site-specific) -------------------------
    for (const o of ot) {
      const id = o.kind === 'driver' ? DRIVER_DUTY_LINE_ID : o.siteId!;
      const model: PayModel = o.kind === 'driver' ? 'driver' : multiSite ? 'site_visit' : 'labor';
      const existed = lines.has(id);
      const l = lineFor(id, model);
      const rate = dailyRateOn(emp, o.date);
      l.otHours += o.hours;
      l.otPay += o.hours * calculateOtRate(rate);
      if (!existed) anomalies.push(`${o.date}: ${o.hours} OT hours at ${l.siteName} without shift attendance`);
      if (rate <= 0) anomalies.push(`${o.date}: OT recorded but daily salary is not set`);
    }

    const sitesArr = Array.from(lines.values())
      .map((l) => ({ ...l, normalPay: round2(l.normalPay), otPay: round2(l.otPay), total: round2(l.normalPay + l.otPay) }))
      .sort((a, b) => (a.siteId === DRIVER_DUTY_LINE_ID ? 1 : b.siteId === DRIVER_DUTY_LINE_ID ? -1 : a.siteName.localeCompare(b.siteName)));

    const daysWorked = sitesArr.reduce((s, l) => s + l.days, 0);
    const visits = sitesArr.reduce((s, l) => s + l.visits, 0);
    const otHours = sitesArr.reduce((s, l) => s + l.otHours, 0);
    const normalPay = round2(sitesArr.reduce((s, l) => s + l.normalPay, 0));
    const otPay = round2(sitesArr.reduce((s, l) => s + l.otPay, 0));

    // Distinct calendar days with any work — transport counts days present.
    const workedDates = new Set<string>();
    for (const s of shifts) workedDates.add(s.date);
    const transportDays = multiSite ? workedDates.size : daysWorked;
    const distinctSites = sitesArr.filter((l) => l.siteId !== DRIVER_DUTY_LINE_ID).length;
    const transport = calculateTransportAllowance(emp, { days: transportDays, distinctSites }, input.settings?.transportBands);

    const gross = round2(normalPay + otPay + transport.amount);

    // ---- Advances ----------------------------------
    const advances: AdvanceLine[] = includeDeductions
      ? (input.advances || [])
          .filter((a) => matchesEmployee(emp, a.employeeId) && isAdvanceAvailableForWeek(a, period.end))
          .map((a) => ({
            id: a.id,
            date: advanceDate(a),
            amount: Number(a.amount) || 0,
            reason: a.reason || '',
            status: a.status,
            deduct: input.advanceSelections?.[a.id] ?? (input.settings?.autoDeductAdvances !== false),
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
      : [];
    const advanceDeduction = round2(advances.filter((a) => a.deduct).reduce((s, a) => s + a.amount, 0));
    const advanceCarriedForward = round2(advances.filter((a) => !a.deduct).reduce((s, a) => s + a.amount, 0));

    // ---- Loans --------------------------------------
    const loans: LoanLine[] = includeDeductions && input.settings?.autoDeductLoans !== false
      ? (input.loans || [])
          .filter((l) => matchesEmployee(emp, l.employeeId) && (l.status === 'active') && Number(l.remainingAmount) > 0)
          .map((l) => {
            const amount = Math.min(Number(l.emiAmount) || 0, Number(l.remainingAmount) || 0);
            return {
              loanId: l.id,
              emiNumber: (Number(l.paidEmis) || 0) + 1,
              totalEmis: Number(l.totalEmis) || 0,
              amount,
              remainingAfter: round2((Number(l.remainingAmount) || 0) - amount),
            };
          })
      : [];
    const loanDeduction = round2(loans.reduce((s, l) => s + l.amount, 0));

    const totalDeductions = round2(advanceDeduction + loanDeduction);
    const finalSalary = round2(gross - totalDeductions);
    if (finalSalary < 0) anomalies.push(`Deductions (${totalDeductions}) exceed gross salary (${gross})`);

    employees.push({
      employeeId: emp.uid,
      workerId: emp.workerId || emp.uid,
      employeeName: emp.displayName || emp.email || emp.workerId || emp.uid,
      role,
      isActive: emp.isActive !== false,
      dailyRate: Number(emp.dailyRate) || 0,
      otRate: calculateOtRate(Number(emp.dailyRate) || 0),
      siteVisitRate,
      sites: sitesArr,
      daysWorked,
      visits,
      otHours,
      normalPay,
      otPay,
      transport: round2(transport.amount),
      transportBasis: transport.basis,
      gross,
      advances,
      advanceDeduction,
      advanceCarriedForward,
      loans,
      loanDeduction,
      totalDeductions,
      finalSalary,
      anomalies: Array.from(new Set(anomalies)),
    });
  }

  employees.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  // ---- Site totals (all employees at each site) -------
  const siteTotals = new Map<string, SitePayrollTotal & { ids: Set<string> }>();
  for (const e of employees) {
    for (const l of e.sites) {
      if (l.siteId === DRIVER_DUTY_LINE_ID) continue;
      const t = siteTotals.get(l.siteId) || {
        siteId: l.siteId, siteName: l.siteName, employeeCount: 0, days: 0, visits: 0,
        otHours: 0, normalPay: 0, otPay: 0, total: 0, ids: new Set<string>(),
      };
      t.ids.add(e.employeeId);
      t.days += l.days;
      t.visits += l.visits;
      t.otHours += l.otHours;
      t.normalPay += l.normalPay;
      t.otPay += l.otPay;
      t.total += l.total;
      siteTotals.set(l.siteId, t);
    }
  }
  const sites: SitePayrollTotal[] = Array.from(siteTotals.values())
    .map(({ ids, ...t }) => ({ ...t, employeeCount: ids.size, normalPay: round2(t.normalPay), otPay: round2(t.otPay), total: round2(t.total) }))
    .sort((a, b) => a.siteName.localeCompare(b.siteName));

  const sum = (f: (e: EmployeePayroll) => number) => round2(employees.reduce((s, e) => s + f(e), 0));
  const driverTotal = round2(employees.reduce((s, e) => s + e.sites.filter((l) => l.siteId === DRIVER_DUTY_LINE_ID).reduce((x, l) => x + l.total, 0), 0));
  const totals: PayrollTotals = {
    employees: employees.length,
    days: sum((e) => e.daysWorked),
    visits: sum((e) => e.visits),
    otHours: sum((e) => e.otHours),
    normalPay: sum((e) => e.normalPay),
    otPay: sum((e) => e.otPay),
    siteTotal: round2(sites.reduce((s, t) => s + t.total, 0)),
    driverTotal,
    transport: sum((e) => e.transport),
    gross: sum((e) => e.gross),
    advances: sum((e) => e.advanceDeduction),
    carriedForward: sum((e) => e.advanceCarriedForward),
    loans: sum((e) => e.loanDeduction),
    deductions: sum((e) => e.totalDeductions),
    final: sum((e) => e.finalSalary),
  };

  return {
    period,
    employees,
    sites,
    totals,
    anomalies: employees.flatMap((e) => e.anomalies.map((message) => ({ employeeId: e.employeeId, employeeName: e.employeeName, message }))),
  };
}
