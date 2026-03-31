/**
 * =====================================================
 * PAYROLL SERVICE
 * =====================================================
 * Data operations for payroll management.
 */

import {
  getDocument,
  getDocuments,
  getPaginatedDocuments,
  createDocument,
  updateDocument,
  query,
  where,
  orderBy,
} from '@/lib/firebase/firestore';
import { uploadPayslip, getFileUrl } from '@/lib/firebase/storage';
import { COLLECTIONS, PAYROLL_CONFIG } from '@/constants';
import {
  toISODateString,
  getWeekStart,
  getWeekEnd,
  addTime,
  subTime,
} from '@/lib/date-utils';
import { calculateOtRate, calculateOtPay, calculateBasePay, calculatePayrollBreakdown } from "@/domain/payroll";
import { getWorkerWeeklyAttendanceSummary, getWorkerWeeklyAttendanceBySite } from './attendance-service';
import { getEmployee } from './employee-service';
import { getPendingAdvancesByWorkerIds, markAdvanceDeducted } from './advance-service';
import { getActiveSites, getAllSites } from './site-service';
import type {
  WeeklyPayroll,
  PayrollStatus,
  PaymentMethod,
  BonusEntry,
  AdvanceDeduction,
  LoanDeduction,
  OtherDeduction,
  SiteBreakdown,
  PaginatedResponse,
  PaginationParams,
  UserProfile,
  DateRange,
} from '@/types';

// =====================================================
// PAYROLL CALCULATION HELPERS
// =====================================================

/**
 * Calculate payroll breakdown for a single site
 */
export function calculateSiteBreakdown(siteId: string, siteName: string, daysWorked: number, otHours: number, dailyRate: number) {
  const otRate = calculateOtRate(dailyRate);
  const basePay = daysWorked * dailyRate;
  const otPay = otHours * otRate;
  return { siteId, siteName, daysWorked, otHours, basePay, otRate, otPay, totalPay: basePay + otPay };
}

/**
 * Aggregate a worker's payroll across all sites
 */
export function aggregateWorkerPayroll(workerId: string, workerName: string, dailyRate: number, siteBreakdowns: any[], advance: number, loan: number, other: number) {
  let totalDaysWorked = 0, totalOtHours = 0, totalBasePay = 0, totalOtPay = 0, grossPay = 0;
  for (const b of siteBreakdowns) {
    totalDaysWorked += b.daysWorked;
    totalOtHours += b.otHours;
    totalBasePay += b.basePay;
    totalOtPay += b.otPay;
    grossPay += b.totalPay;
  }
  return { workerId, workerName, totalDaysWorked, totalOtHours, totalBasePay, totalOtPay, grossPay, advanceDeduction: advance, loanDeduction: loan, otherDeduction: other, finalPay: Math.max(0, grossPay - advance - loan - other) };
}

// =====================================================
// TYPES
// =====================================================

export type SitePayrollSummary = {
  siteId: string;
  siteName: string;
  totalWorkers: number;
  totalDaysWorked: number;
  totalOtHours: number;
  totalBasePay: number;
  totalOtPay: number;
  totalGrossPay: number;
};

export type PayrollSummary = {
  totalWorkers: number;
  totalDaysWorked: number;
  totalOtHours: number;
  totalBasePay: number;
  totalOtPay: number;
  totalGrossSalary: number;
  totalAdvanceDeductions: number;
  totalLoanDeductions: number;
  totalOtherDeductions: number;
  finalPayrollTotal: number;
};

/**
 * Aggregate payroll data by site from worker records
 */
export function aggregateSitePayroll(workers: any[]): SitePayrollSummary[] {
  const siteMap = new Map<string, SitePayrollSummary>();

  for (const worker of workers) {
    const siteBreakdowns = worker.siteBreakdowns || worker.sites || [];
    for (const site of siteBreakdowns) {
      const siteId = site.siteId;
      const existing = siteMap.get(siteId) || {
        siteId,
        siteName: site.siteName || siteId,
        totalWorkers: 0,
        totalDaysWorked: 0,
        totalOtHours: 0,
        totalBasePay: 0,
        totalOtPay: 0,
        totalGrossPay: 0,
      };

      existing.totalWorkers += 1;
      existing.totalDaysWorked += site.daysWorked || 0;
      existing.totalOtHours += site.otHours || 0;
      existing.totalBasePay += site.basePay || 0;
      existing.totalOtPay += site.otPay || 0;
      existing.totalGrossPay += site.totalPay || 0;

      siteMap.set(siteId, existing);
    }
  }

  return Array.from(siteMap.values()).sort((a, b) => b.totalGrossPay - a.totalGrossPay);
}

/**
 * Calculate overall payroll summary from all workers
 */
export function calculateOverallPayroll(workers: any[]): PayrollSummary {
  return workers.reduce((acc, w) => {
    acc.totalWorkers++;
    acc.totalDaysWorked += w.totalDaysWorked || 0;
    acc.totalOtHours += w.totalOtHours || 0;
    acc.totalBasePay += w.totalBasePay || 0;
    acc.totalOtPay += w.totalOtPay || 0;
    acc.totalGrossSalary += w.grossPay || 0;
    acc.totalAdvanceDeductions += w.advanceDeduction || 0;
    acc.totalLoanDeductions += w.loanDeduction || 0;
    acc.totalOtherDeductions += w.otherDeduction || 0;
    acc.finalPayrollTotal += w.finalPay || w.grossPay || 0;
    return acc;
  }, {
    totalWorkers: 0, totalDaysWorked: 0, totalOtHours: 0,
    totalBasePay: 0, totalOtPay: 0, totalGrossSalary: 0,
    totalAdvanceDeductions: 0, totalLoanDeductions: 0,
    totalOtherDeductions: 0, finalPayrollTotal: 0,
  });
}


/**
 * Get payroll record by ID
 */
export async function getPayroll(payrollId: string): Promise<WeeklyPayroll | null> {
  return getDocument<WeeklyPayroll>(COLLECTIONS.PAYROLL, payrollId);
}

/**
 * Get payroll for a specific employee and week
 */
export async function getEmployeePayrollForWeek(
  employeeId: string,
  weekStartDate: string
): Promise<WeeklyPayroll | null> {
  const records = await getDocuments<WeeklyPayroll>(COLLECTIONS.PAYROLL, [
    where('employeeId', '==', employeeId),
    where('weekStartDate', '==', weekStartDate),
  ]);
  
  return records.length > 0 ? records[0] : null;
}

/**
 * Get all payrolls for a week
 */
export async function getPayrollsForWeek(weekStartDate: string): Promise<WeeklyPayroll[]> {
  const results = await getDocuments<WeeklyPayroll>(COLLECTIONS.PAYROLL, [
    where('weekStartDate', '==', weekStartDate),
  ]);
  return results.sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));
}

/**
 * Get payrolls with pagination
 */
export async function getPayrollsPaginated(
  params: PaginationParams,
  filters?: {
    employeeId?: string;
    weekStartDate?: string;
    status?: PayrollStatus;
  }
): Promise<PaginatedResponse<WeeklyPayroll>> {
  const constraints = [];

  if (filters?.employeeId) {
    constraints.push(where('employeeId', '==', filters.employeeId));
  }
  
  if (filters?.weekStartDate) {
    constraints.push(where('weekStartDate', '==', filters.weekStartDate));
  }
  
  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  return getPaginatedDocuments<WeeklyPayroll>(
    COLLECTIONS.PAYROLL,
    params,
    constraints
  );
}

/**
 * Get employee payroll history
 */
export async function getEmployeePayrollHistory(
  employeeId: string,
  limit: number = 12
): Promise<WeeklyPayroll[]> {
  const payrolls = await getDocuments<WeeklyPayroll>(COLLECTIONS.PAYROLL, [
    where('employeeId', '==', employeeId),
  ]);
  
  return payrolls
    .sort((a, b) => (b.weekStartDate || '').localeCompare(a.weekStartDate || ''))
    .slice(0, limit);
}

/**
 * Generate payroll for an employee for a specific week
 * Uses domain engines for multi-site calculation and deductions
 */
export async function generateEmployeePayroll(
  employeeId: string,
  weekStartDate: Date,
  generatedBy: string,
  selectedAdvanceIds: string[] = []
): Promise<WeeklyPayroll> {
  // Get employee details
  const employee = await getEmployee(employeeId);

  if (!employee) {
    throw new Error('Employee not found');
  }

  const weekStart = getWeekStart(weekStartDate);
  const weekEnd = getWeekEnd(weekStartDate);
  const weekStartStr = toISODateString(weekStart);
  const weekEndStr = toISODateString(weekEnd);

  // Check if payroll already exists
  const existingPayroll = await getEmployeePayrollForWeek(employeeId, weekStartStr);

  if (existingPayroll) {
    throw new Error('Payroll already exists for this week');
  }

  // Get per-site attendance breakdown
  const workerId = employee.workerId || employee.uid;
  const siteAttendance = await getWorkerWeeklyAttendanceBySite(workerId, weekStartStr, weekEndStr);

  // Get ALL site names for display (including completed/on_hold sites)
  const allSites = await getAllSites();
  const siteNameMap = new Map(allSites.map(s => [s.id, s.name]));

  // ========================================
  // DOMAIN ENGINE: Calculate per-site breakdown
  // ========================================
  const dailyRate = employee.dailyRate || 0;
  const siteBreakdowns: SiteBreakdown[] = Object.entries(siteAttendance).map(
    ([siteId, data]) => {
      return calculateSiteBreakdown(
        siteId,
        siteNameMap.get(siteId) || `Site ${siteId.substring(0, 6)}`,
        data.daysWorked,
        data.otHours,
        dailyRate
      ) as unknown as SiteBreakdown;
    }
  );

  // Get advance deductions for this week
  const allPendingAdvances = await getPendingAdvancesByWorkerIds([workerId]);
  const weekAdvances = allPendingAdvances.filter(a => selectedAdvanceIds.includes(a.id));
  const advanceDeductionAmount = weekAdvances.reduce((sum, a) => sum + a.amount, 0);


  // TODO: Get pending loans
  const loanDeductions: LoanDeduction[] = [];
  const loanDeductionAmount = loanDeductions.reduce((sum, l) => sum + l.emiAmount, 0);

  const otherDeductions: OtherDeduction[] = [];
  const otherDeductionAmount = otherDeductions.reduce((sum, o) => sum + o.amount, 0);

  // ========================================
  // DOMAIN ENGINE: Aggregate worker payroll
  // ========================================
  const workerPayroll = aggregateWorkerPayroll(
    employeeId,
    employee.displayName || employee.email,
    dailyRate,
    siteBreakdowns as any,
    advanceDeductionAmount,
    loanDeductionAmount,
    otherDeductionAmount
  );

  // Map advance records for storage
  const advances: AdvanceDeduction[] = weekAdvances.map((adv: any) => ({
    advanceId: adv.id,
    amount: adv.amount,
    description: adv.reason || 'Advance deduction',
  }));

  // Mark selected advances as deducted
  if (weekAdvances.length > 0) {
    await Promise.all(weekAdvances.map((adv: any) => markAdvanceDeducted(adv.id, weekStartStr)));
  }

  // Create payroll record with domain-calculated values
  const payrollData: Omit<WeeklyPayroll, 'id' | 'createdAt' | 'updatedAt'> = {
    weekStartDate: weekStartStr,
    weekEndDate: weekEndStr,
    employeeId,
    employeeName: workerPayroll.workerName,
    employeeRole: employee.role,

    regularHours: workerPayroll.totalDaysWorked * 8,
    overtimeHours: workerPayroll.totalOtHours,
    totalHours: (workerPayroll.totalDaysWorked * 8) + workerPayroll.totalOtHours,
    daysWorked: workerPayroll.totalDaysWorked,

    regularEarnings: workerPayroll.totalBasePay,
    overtimeEarnings: workerPayroll.totalOtPay,
    bonuses: [],
    totalEarnings: workerPayroll.grossPay,

    siteBreakdowns,

    advances,
    loanDeductions,
    otherDeductions,
    totalDeductions: workerPayroll.advanceDeduction + workerPayroll.loanDeduction + workerPayroll.otherDeduction,

    netPay: workerPayroll.finalPay,
    status: 'draft',

    generatedAt: new Date(),
    generatedBy,
  };

  const id = await createDocument<WeeklyPayroll>(COLLECTIONS.PAYROLL, payrollData as any);

  return {
    id,
    ...payrollData,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Generate payroll for all employees for a week
 */
export async function generateWeeklyPayroll(
  weekStartDate: Date,
  generatedBy: string,
  employeeIds?: string[],
  selectedAdvanceIds: string[] = []
): Promise<{ success: number; failed: number; errors: string[] }> {
  // Import dynamically to avoid circular dependency
  const { getAllEmployees } = await import('./employee-service');
  
  let employees: UserProfile[];
  
  if (employeeIds && employeeIds.length > 0) {
    const allEmployees = await getAllEmployees();
    employees = allEmployees.filter(e => employeeIds.includes(e.uid));
  } else {
    employees = (await getAllEmployees()).filter(e => e.isActive);
  }
  
  let success = 0;
  let failed = 0;
  const errors: string[] = [];
  
  for (const employee of employees) {
    try {
      await generateEmployeePayroll(employee.uid, weekStartDate, generatedBy, selectedAdvanceIds);
      success++;
    } catch (error: any) {
      failed++;
      errors.push(`${employee.displayName || employee.email}: ${error.message}`);
    }
  }
  
  return { success, failed, errors };
}

/**
 * Update payroll status
 */
export async function updatePayrollStatus(
  payrollId: string,
  status: PayrollStatus,
  approvedBy?: string
): Promise<void> {
  const updates: Partial<WeeklyPayroll> = { status };
  
  if (status === 'approved' && approvedBy) {
    updates.approvedAt = new Date();
    updates.approvedBy = approvedBy;
  }
  
  if (status === 'paid') {
    updates.paidAt = new Date();
  }
  
  await updateDocument<WeeklyPayroll>(COLLECTIONS.PAYROLL, payrollId, updates);
}

/**
 * Add bonus to payroll
 */
export async function addBonus(
  payrollId: string,
  bonus: Omit<BonusEntry, 'id'>
): Promise<void> {
  const payroll = await getPayroll(payrollId);
  
  if (!payroll) {
    throw new Error('Payroll not found');
  }
  
  if (payroll.status !== 'draft') {
    throw new Error('Cannot modify non-draft payroll');
  }
  
  const bonusEntry: BonusEntry = {
    id: Date.now().toString(),
    ...bonus,
  };
  
  const bonuses = [...payroll.bonuses, bonusEntry];
  const totalEarnings = payroll.regularEarnings + payroll.overtimeEarnings + 
    bonuses.reduce((sum, b) => sum + b.amount, 0);
  const netPay = totalEarnings - payroll.totalDeductions;
  
  await updateDocument<WeeklyPayroll>(COLLECTIONS.PAYROLL, payrollId, {
    bonuses,
    totalEarnings,
    netPay,
  });
}

/**
 * Add deduction to payroll
 */
export async function addDeduction(
  payrollId: string,
  deduction: Omit<OtherDeduction, 'id'>
): Promise<void> {
  const payroll = await getPayroll(payrollId);
  
  if (!payroll) {
    throw new Error('Payroll not found');
  }
  
  if (payroll.status !== 'draft') {
    throw new Error('Cannot modify non-draft payroll');
  }
  
  const deductionEntry: OtherDeduction = {
    id: Date.now().toString(),
    ...deduction,
  };
  
  const otherDeductions = [...payroll.otherDeductions, deductionEntry];
  const totalDeductions = 
    payroll.advances.reduce((sum, a) => sum + a.amount, 0) +
    payroll.loanDeductions.reduce((sum, l) => sum + l.emiAmount, 0) +
    otherDeductions.reduce((sum, o) => sum + o.amount, 0);
  const netPay = payroll.totalEarnings - totalDeductions;
  
  await updateDocument<WeeklyPayroll>(COLLECTIONS.PAYROLL, payrollId, {
    otherDeductions,
    totalDeductions,
    netPay,
  });
}

/**
 * Mark payroll as paid
 */
export async function markAsPaid(
  payrollId: string,
  paymentMethod: PaymentMethod
): Promise<void> {
  await updateDocument<WeeklyPayroll>(COLLECTIONS.PAYROLL, payrollId, {
    status: 'paid',
    paidAt: new Date(),
    paymentMethod,
  });
}

/**
 * Get payroll summary for a week
 */
export async function getWeeklyPayrollSummary(weekStartDate: string): Promise<{
  totalEmployees: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalEarnings: number;
  totalDeductions: number;
  totalNetPay: number;
  statusBreakdown: Record<PayrollStatus, number>;
}> {
  const payrolls = await getPayrollsForWeek(weekStartDate);

  const statusBreakdown: Record<PayrollStatus, number> = {
    draft: 0,
    pending_approval: 0,
    approved: 0,
    paid: 0,
    cancelled: 0,
  };

  payrolls.forEach(p => {
    statusBreakdown[p.status] = (statusBreakdown[p.status] || 0) + 1;
  });

  return {
    totalEmployees: payrolls.length,
    totalRegularHours: payrolls.reduce((sum, p) => sum + p.regularHours, 0),
    totalOvertimeHours: payrolls.reduce((sum, p) => sum + p.overtimeHours, 0),
    totalEarnings: payrolls.reduce((sum, p) => sum + p.totalEarnings, 0),
    totalDeductions: payrolls.reduce((sum, p) => sum + p.totalDeductions, 0),
    totalNetPay: payrolls.reduce((sum, p) => sum + p.netPay, 0),
    statusBreakdown,
  };
}

/**
 * Get site summaries for a week (for payroll page site cards)
 * Returns aggregated site totals using domain engine
 */
export async function getSitePayrollSummary(weekStartDate: string): Promise<SitePayrollSummary[]> {
  const payrolls = await getPayrollsForWeek(weekStartDate);

  if (payrolls.length === 0) {
    return [];
  }

  // Create workerPayroll objects from stored payroll records
  const workers = payrolls.map(p => ({
    workerId: p.employeeId,
    workerName: p.employeeName || '',
    dailyRate: p.regularEarnings > 0 ? p.regularEarnings / (p.daysWorked || 1) : 0,
    totalDaysWorked: p.daysWorked,
    totalOtHours: p.overtimeHours,
    totalBasePay: p.regularEarnings,
    totalOtPay: p.overtimeEarnings,
    grossPay: p.totalEarnings,
  }));

  return aggregateSitePayroll(workers as any);
}

/**
 * Get grand payroll summary for a week (for payroll page totals section)
 * Returns overall summary using domain engine
 */
export async function getGrandPayrollSummary(weekStartDate: string): Promise<PayrollSummary> {
  const payrolls = await getPayrollsForWeek(weekStartDate);

  if (payrolls.length === 0) {
    return {
      totalWorkers: 0,
      totalDaysWorked: 0,
      totalOtHours: 0,
      totalBasePay: 0,
      totalOtPay: 0,
      totalGrossSalary: 0,
      totalAdvanceDeductions: 0,
      totalLoanDeductions: 0,
      totalOtherDeductions: 0,
      finalPayrollTotal: 0,
    };
  }

  const workers = payrolls.map(p => ({
    workerId: p.employeeId,
    workerName: p.employeeName || '',
    dailyRate: p.regularEarnings > 0 ? p.regularEarnings / (p.daysWorked || 1) : 0,
    totalDaysWorked: p.daysWorked,
    totalOtHours: p.overtimeHours,
    totalBasePay: p.regularEarnings,
    totalOtPay: p.overtimeEarnings,
    grossPay: p.totalEarnings,
  }));

  return calculateOverallPayroll(workers as any);
}

/**
 * Upload payslip PDF
 */
export async function uploadPayslipPdf(
  payrollId: string,
  pdfBlob: Blob
): Promise<string> {
  const payroll = await getPayroll(payrollId);
  
  if (!payroll) {
    throw new Error('Payroll not found');
  }
  
  const url = await uploadPayslip(pdfBlob, payroll.employeeId, payroll.weekStartDate);
  
  await updateDocument<WeeklyPayroll>(COLLECTIONS.PAYROLL, payrollId, {
    payslipUrl: url,
  });
  
  return url;
}

