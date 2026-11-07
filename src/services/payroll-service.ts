/**
 * =====================================================
 * PAYROLL SERVICE
 * =====================================================
 * Loads payroll inputs from Firestore, runs the single payroll engine
 * (domain/payroll/engine.ts) and stores approved weekly payroll records.
 * There is NO calculation in this file — only data access.
 */

import { getDocuments, getDocument, updateDocument, where } from '@/lib/firebase/firestore';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COLLECTIONS } from '@/constants';
import { addDaysISO, eachDateISO, getPayrollWeek } from '@/lib/date-utils';
import { computePayroll, type EmployeePayroll, type PayrollEngineInput, type PayrollEngineResult } from '@/domain/payroll';
import { getSimpleAttendanceForDateRange } from './attendance-service';
import { getAllEmployees } from './employee-service';
import { getAllSites } from './site-service';
import { getAllPendingAdvances } from './advance-service';
import { getActiveLoans } from './loan-service';
import { getPayrollSettings } from './settings-service';
import { createAuditLog, auditAction } from './audit-service';
import { createLogger } from '@/lib/logger';
import type { Loan, LoanPayment, PaymentMethod, PayrollStatus, UserRole, WeeklyPayroll } from '@/types';

const log = createLogger('PayrollService');

// =====================================================
// READS
// =====================================================

export async function getPayroll(payrollId: string): Promise<WeeklyPayroll | null> {
  return getDocument<WeeklyPayroll>(COLLECTIONS.PAYROLL, payrollId);
}

/**
 * Stored payroll records for a payroll week. Also returns records created
 * under the legacy Sunday→Saturday week (weekStartDate = the Sunday before).
 */
export async function getPayrollsForWeek(weekStartDate: string): Promise<WeeklyPayroll[]> {
  const legacyStart = addDaysISO(weekStartDate, -1);
  const results = await getDocuments<WeeklyPayroll>(COLLECTIONS.PAYROLL, [
    where('weekStartDate', 'in', [weekStartDate, legacyStart]),
  ]);
  return results
    .filter((p) => p.status !== 'cancelled')
    .sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));
}

export async function getEmployeePayrollHistory(employeeId: string, limit = 12): Promise<WeeklyPayroll[]> {
  const payrolls = await getDocuments<WeeklyPayroll>(COLLECTIONS.PAYROLL, [where('employeeId', '==', employeeId)]);
  return payrolls.sort((a, b) => (b.weekStartDate || '').localeCompare(a.weekStartDate || '')).slice(0, limit);
}

/**
 * Stored (non-cancelled) payrolls whose period overlaps [start, end].
 * Used to make sure no date is ever paid twice.
 */
async function getStoredPayrollsOverlapping(start: string, end: string): Promise<WeeklyPayroll[]> {
  // weekStartDate ≤ end and weekEndDate ≥ start; Firestore allows one range
  // field per query, so filter the second bound in memory (≤ 2 weeks of data).
  const candidates = await getDocuments<WeeklyPayroll>(COLLECTIONS.PAYROLL, [
    where('weekStartDate', '>=', addDaysISO(start, -7)),
    where('weekStartDate', '<=', end),
  ]);
  return candidates.filter((p) => p.status !== 'cancelled' && (p.weekEndDate || p.weekStartDate) >= start);
}

// =====================================================
// ENGINE INPUTS
// =====================================================

export interface PayrollPreviewOptions {
  advanceSelections?: Record<string, boolean>;
  includeDeductions?: boolean;
}

export type PayrollInputs = Omit<PayrollEngineInput, 'advanceSelections'>;

/**
 * Load every input for a period once. The UI keeps these in the query cache
 * and re-runs the (pure, fast) engine when advance ticks change.
 */
export async function loadPayrollInputs(
  period: { start: string; end: string },
  options: { includeDeductions?: boolean; excludePaidDates?: boolean } = {}
): Promise<PayrollInputs & { storedPayrolls: WeeklyPayroll[] }> {
  const [attendance, employees, sites, advances, loans, settings, stored] = await Promise.all([
    getSimpleAttendanceForDateRange(period.start, period.end),
    getAllEmployees(),
    getAllSites(),
    options.includeDeductions === false ? Promise.resolve([]) : getAllPendingAdvances(),
    options.includeDeductions === false ? Promise.resolve([] as Loan[]) : getActiveLoans(),
    getPayrollSettings().catch(() => null),
    options.excludePaidDates ? getStoredPayrollsOverlapping(period.start, period.end) : Promise.resolve([] as WeeklyPayroll[]),
  ]);

  const excludeDates = new Map<string, Set<string>>();
  for (const p of stored) {
    const set = excludeDates.get(p.employeeId) || new Set<string>();
    for (const d of eachDateISO(p.weekStartDate, p.weekEndDate || p.weekStartDate)) set.add(d);
    excludeDates.set(p.employeeId, set);
  }

  return {
    period,
    attendance,
    employees,
    sites: sites.map((s) => ({ id: s.id, name: s.name })),
    advances,
    loans,
    settings: {
      supervisorSiteVisitRate: settings?.supervisorSiteVisitRate,
      transportBands: settings?.transportBands,
      autoDeductAdvances: settings?.autoDeductAdvances,
      autoDeductLoans: settings?.autoDeductLoans,
    },
    excludeDates,
    includeDeductions: options.includeDeductions,
    storedPayrolls: stored,
  };
}

/** Load + compute in one call (reports, generation). */
export async function computePayrollForPeriod(
  period: { start: string; end: string },
  options: PayrollPreviewOptions & { excludePaidDates?: boolean } = {}
): Promise<PayrollEngineResult> {
  const inputs = await loadPayrollInputs(period, options);
  return computePayroll({ ...inputs, advanceSelections: options.advanceSelections });
}

/** Live preview for a payroll week (dates already in stored payroll excluded). */
export async function previewWeeklyPayroll(weekStart: string, advanceSelections: Record<string, boolean> = {}) {
  const period = getPayrollWeek(weekStart);
  return computePayrollForPeriod(period, { advanceSelections, excludePaidDates: true });
}

// =====================================================
// GENERATION (approve & store)
// =====================================================

export function payrollDocId(weekStart: string, employeeId: string): string {
  return `${weekStart}_${employeeId}`;
}

function toStoredPayroll(e: EmployeePayroll, period: { start: string; end: string }, generatedBy: string) {
  return {
    weekStartDate: period.start,
    weekEndDate: period.end,
    employeeId: e.employeeId,
    workerId: e.workerId,
    employeeName: e.employeeName,
    employeeRole: e.role as UserRole,
    regularHours: e.daysWorked * 8,
    overtimeHours: e.otHours,
    totalHours: e.daysWorked * 8 + e.otHours,
    daysWorked: e.daysWorked,
    siteVisits: e.visits,
    dailyRate: e.dailyRate,
    otRate: e.otRate,
    regularEarnings: e.normalPay,
    overtimeEarnings: e.otPay,
    transportAllowance: e.transport,
    transportBasis: e.transportBasis,
    bonuses: [],
    totalEarnings: e.gross,
    siteBreakdowns: e.sites.map((l) => ({
      siteId: l.siteId,
      siteName: l.siteName,
      payModel: l.payModel,
      daysWorked: l.days,
      visits: l.visits,
      otHours: l.otHours,
      regularPay: l.normalPay,
      otPay: l.otPay,
      totalPay: l.total,
    })),
    advances: e.advances.filter((a) => a.deduct).map((a) => ({ advanceId: a.id, amount: a.amount, description: a.reason || 'Advance deduction', date: a.date })),
    advancesCarriedForward: e.advances.filter((a) => !a.deduct).map((a) => ({ advanceId: a.id, amount: a.amount, date: a.date })),
    loanDeductions: e.loans.map((l) => ({ loanId: l.loanId, emiAmount: l.amount, emiNumber: l.emiNumber, totalEmis: l.totalEmis, remainingAmount: l.remainingAfter })),
    otherDeductions: [],
    totalDeductions: e.totalDeductions,
    netPay: e.finalSalary,
    anomalies: e.anomalies,
    status: 'approved' as PayrollStatus,
    generatedAt: serverTimestamp(),
    generatedBy,
    approvedAt: serverTimestamp(),
    approvedBy: generatedBy,
    engineVersion: 2,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * Approve & store the weekly payroll exactly as previewed.
 * - one payroll document per employee per week (deterministic id; never duplicated)
 * - ticked advances marked deducted (with the deduction week)
 * - unticked advances stay outstanding and are flagged carried forward
 * - loan instalments are recorded when the payroll is marked PAID
 */
export async function generateWeeklyPayroll(
  weekStart: string,
  generatedBy: { uid: string; name: string; role: UserRole },
  advanceSelections: Record<string, boolean> = {}
): Promise<{ success: number; skipped: number; failed: number; errors: string[] }> {
  const period = getPayrollWeek(weekStart);
  const result = await computePayrollForPeriod(period, { advanceSelections, excludePaidDates: true });

  let success = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const e of result.employees) {
    const ref = doc(db, COLLECTIONS.PAYROLL, payrollDocId(period.start, e.employeeId));
    try {
      const created = await runTransaction(db, async (tx) => {
        const existing = await tx.get(ref);
        if (existing.exists()) return false;
        // Re-check advances inside the transaction so none is deducted twice.
        const advSnaps = await Promise.all(e.advances.map((a) => tx.get(doc(db, COLLECTIONS.ADVANCES, a.id))));
        for (const s of advSnaps) {
          const d = s.data();
          if (d && (d.isDeducted === true || d.deducted === true)) {
            throw new Error(`Advance ${s.id} was already deducted — refresh and try again`);
          }
        }
        tx.set(ref, toStoredPayroll(e, period, generatedBy.uid));
        e.advances.forEach((a, i) => {
          const advRef = advSnaps[i].ref;
          if (a.deduct) {
            tx.update(advRef, {
              isDeducted: true,
              deducted: true,
              deductedWeek: period.start,
              deductionWeekId: period.start,
              deductedInPayrollId: ref.id,
              carryForward: false,
              advanceState: 'fully_deducted',
              updatedAt: serverTimestamp(),
            });
          } else {
            tx.update(advRef, { carryForward: true, deductThisWeek: false, advanceState: 'carried_forward', lastCarriedForwardWeek: period.start, updatedAt: serverTimestamp() });
          }
        });
        return true;
      });
      if (created) success++;
      else skipped++;
    } catch (err) {
      errors.push(`${e.employeeName}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await createAuditLog({
    userId: generatedBy.uid,
    userName: generatedBy.name,
    userRole: generatedBy.role,
    action: 'approve',
    resource: 'payroll',
    resourceId: period.start,
    newValue: {
      week: `${period.start}..${period.end}`,
      employees: success,
      gross: result.totals.gross,
      advances: result.totals.advances,
      loans: result.totals.loans,
      final: result.totals.final,
      deductedAdvanceIds: result.employees.flatMap((e) => e.advances.filter((a) => a.deduct).map((a) => a.id)),
      carriedForwardAdvanceIds: result.employees.flatMap((e) => e.advances.filter((a) => !a.deduct).map((a) => a.id)),
    },
  });

  log.info('Weekly payroll generated', { week: period.start, success, skipped, failed: errors.length });
  return { success, skipped, failed: errors.length, errors };
}

// =====================================================
// STATUS CHANGES
// =====================================================

export async function updatePayrollStatus(payrollId: string, status: PayrollStatus, approvedBy?: string): Promise<void> {
  if (status === 'paid') return markAsPaid(payrollId, 'cash', approvedBy);
  const updates: Partial<WeeklyPayroll> = { status };
  if (status === 'approved' && approvedBy) {
    updates.approvedAt = new Date();
    updates.approvedBy = approvedBy;
  }
  await updateDocument<WeeklyPayroll>(COLLECTIONS.PAYROLL, payrollId, updates);
}

/**
 * Mark a payroll paid and record its loan instalments (idempotent: a loan
 * payment is recorded at most once per payroll id).
 */
export async function markAsPaid(payrollId: string, paymentMethod: PaymentMethod, paidBy?: string): Promise<void> {
  const payroll = await getPayroll(payrollId);
  if (!payroll) throw new Error('Payroll not found');
  if (payroll.status === 'paid') return;

  for (const ld of payroll.loanDeductions || []) {
    await recordLoanInstalment(ld.loanId, payrollId, Number(ld.emiAmount) || 0);
  }
  await updateDocument<WeeklyPayroll>(COLLECTIONS.PAYROLL, payrollId, {
    status: 'paid',
    paidAt: new Date(),
    paymentMethod,
    ...(paidBy ? { paidBy } : {}),
  } as Partial<WeeklyPayroll>);
  await auditAction('update', 'payroll', payrollId, {
    newValue: { status: 'paid', netPay: payroll.netPay, loanInstalments: (payroll.loanDeductions || []).length },
  });
}

/** Record one loan instalment for a payroll, at most once. */
export async function recordLoanInstalment(loanId: string, payrollId: string, amount: number): Promise<void> {
  const ref = doc(db, COLLECTIONS.LOANS, loanId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error(`Loan ${loanId} not found`);
    const loan = snap.data() as Loan;
    const payments: LoanPayment[] = Array.isArray(loan.payments) ? loan.payments : [];
    if (payments.some((p) => p.payrollId === payrollId)) return; // already recorded
    const remaining = Number(loan.remainingAmount) || 0;
    const pay = Math.min(amount, remaining);
    if (pay <= 0) return;
    const paidEmis = (Number(loan.paidEmis) || 0) + 1;
    const newRemaining = Math.max(0, Math.round((remaining - pay) * 100) / 100);
    const complete = newRemaining <= 0;
    tx.update(ref, {
      payments: [...payments, { id: `${payrollId}`, emiNumber: paidEmis, amount: pay, payrollId, paidAt: new Date() }],
      paidEmis,
      remainingAmount: newRemaining,
      status: complete ? 'completed' : 'active',
      ...(complete ? { completedAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    });
  });
}
