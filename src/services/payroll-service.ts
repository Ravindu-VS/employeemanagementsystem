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
import { getDriverAttendanceForDateRange } from './attendance-service';
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
  UserRole,
} from '@/types';



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
  const otRate = employee.otRate || 0;
  
  let siteBreakdowns: SiteBreakdown[] = [];
  
  if (employee.payType === 'daily_based' || employee.role === 'driver') {
    // For daily_based workers (like drivers), fetch driver attendance
    const driverAttendanceList = await getDriverAttendanceForDateRange(weekStartStr, weekEndStr);
    const workerDriverAttendance = driverAttendanceList.filter(a => a.workerId === workerId && (a.morningPresent || a.eveningPresent || a.present));
    
    let driverDaysWorked = 0;
    let driverOtHours = 0;
    
    workerDriverAttendance.forEach(a => {
      const morningVal = a.morningPresent ?? a.present ?? false;
      const eveningVal = a.eveningPresent ?? a.present ?? false;
      if (morningVal) driverDaysWorked += 0.5;
      if (eveningVal) driverDaysWorked += 0.5;
      
      const morningOtVal = a.morningOtHours ?? 0;
      const eveningOtVal = a.eveningOtHours ?? 0;
      driverOtHours += morningOtVal + eveningOtVal + (a.morningOtHours === undefined && a.eveningOtHours === undefined ? (a.otHours || 0) : 0);
    });
    
    if (driverDaysWorked > 0 || driverOtHours > 0) {
      siteBreakdowns.push({
        siteId: 'transportation',
        siteName: 'Transportation Duties',
        daysWorked: driverDaysWorked,
        otHours: driverOtHours,
        regularPay: driverDaysWorked * dailyRate,
        otPay: driverOtHours * otRate,
        totalPay: (driverDaysWorked * dailyRate) + (driverOtHours * otRate),
      });
    }
  } else {
    // For site_based workers
    siteBreakdowns = Object.entries(siteAttendance).map(
      ([siteId, data]) => {
        const regularPay = data.daysWorked * dailyRate;
        const otPay = data.otHours * otRate;
        return {
          siteId,
          siteName: siteNameMap.get(siteId) || siteId,
          daysWorked: data.daysWorked,
          otHours: data.otHours,
          regularPay,
          otPay,
          totalPay: regularPay + otPay,
        };
      }
    );
  }
  
  // Aggregate totals across all sites
  const daysWorked = siteBreakdowns.reduce((s, b) => s + b.daysWorked, 0);
  const overtimeHours = siteBreakdowns.reduce((s, b) => s + b.otHours, 0);
  
  // Calculate transport allowance
  let transportAllowance = 0;
  if (employee.transportType && employee.transportType !== 'none' && employee.transportType !== 'company_vehicle') {
    const tRate = employee.transportRate || 0;
    const distance = employee.distance || 0;
    const rateType = employee.transportRateType || 'per_day';
    const sitesVisitedCount = siteBreakdowns.length;
    
    if (rateType === 'per_km') {
      transportAllowance = distance * tRate * daysWorked;
    } else if (rateType === 'per_day') {
      transportAllowance = tRate * daysWorked;
    } else if (rateType === 'per_week') {
      transportAllowance = tRate;
    } else if (rateType === 'per_site') {
      transportAllowance = tRate * sitesVisitedCount;
    }
  }

  const regularHours = daysWorked * 8;
  const totalHours = regularHours + overtimeHours;
  // Get advance deductions for this week
  const allPendingAdvances = await getPendingAdvancesByWorkerIds([workerId]);
  const weekAdvances = allPendingAdvances.filter(a => selectedAdvanceIds.includes(a.id));
  const advanceDeductionAmount = weekAdvances.reduce((sum, a) => sum + a.amount, 0);

  // Get active loans
  const { getEmployeeActiveLoan } = await import('./loan-service');
  const activeLoan = await getEmployeeActiveLoan(employeeId);
  const loanDeductions: LoanDeduction[] = [];
  if (activeLoan) {
    const deduction = Math.min(activeLoan.emiAmount, activeLoan.remainingAmount);
    loanDeductions.push({
      loanId: activeLoan.id,
      emiNumber: activeLoan.paidEmis + 1,
      emiAmount: deduction,
      totalEmis: activeLoan.totalEmis,
      remainingAmount: activeLoan.remainingAmount - deduction,
    });
  }
  const loanDeductionAmount = loanDeductions.reduce((sum, l) => sum + l.emiAmount, 0);

  const otherDeductions: OtherDeduction[] = [];
  const otherDeductionAmount = otherDeductions.reduce((sum, o) => sum + o.amount, 0);

  // ========================================
  // DOMAIN ENGINE: Aggregate worker payroll
  // ========================================
  let totalDaysWorked = 0, totalOtHours = 0, totalBasePay = 0, totalOtPay = 0, grossPay = 0;
  for (const b of siteBreakdowns) {
    totalDaysWorked += b.daysWorked;
    totalOtHours += b.otHours;
    totalBasePay += b.regularPay;
    totalOtPay += b.otPay;
    grossPay += b.totalPay;
  }
  const grossWithTransport = grossPay + transportAllowance;
  const workerPayroll = {
    workerId: employeeId,
    workerName: employee.displayName || employee.email,
    totalDaysWorked,
    totalOtHours,
    totalBasePay,
    totalOtPay,
    grossPay: grossWithTransport,
    transportAllowance,
    advanceDeduction: advanceDeductionAmount,
    loanDeduction: loanDeductionAmount,
    otherDeduction: otherDeductionAmount,
    finalPay: Math.max(0, grossWithTransport - advanceDeductionAmount - loanDeductionAmount - otherDeductionAmount),
  };

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
    employeeRole: (employee.role || 'helper') as UserRole,

    regularHours: workerPayroll.totalDaysWorked * 8,
    overtimeHours: workerPayroll.totalOtHours,
    totalHours: (workerPayroll.totalDaysWorked * 8) + workerPayroll.totalOtHours,
    daysWorked: workerPayroll.totalDaysWorked,

    regularEarnings: workerPayroll.totalBasePay,
    overtimeEarnings: workerPayroll.totalOtPay,
    transportAllowance,
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
    
    // Process loan repayments
    const payroll = await getPayroll(payrollId);
    if (payroll && payroll.loanDeductions && payroll.loanDeductions.length > 0) {
      const { recordLoanPayment } = await import('./loan-service');
      for (const ld of payroll.loanDeductions) {
        try {
          await recordLoanPayment(ld.loanId, payrollId);
        } catch (err) {
          console.error(`Failed to record loan payment for loan ${ld.loanId}:`, err);
        }
      }
    }
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
 * Returns aggregated site totals from stored payroll records
 */
export async function getSitePayrollSummary(weekStartDate: string) {
  const payrolls = await getPayrollsForWeek(weekStartDate);
  if (payrolls.length === 0) return [];

  const siteMap = new Map<string, {
    siteId: string; siteName: string;
    totalWorkers: number; totalDaysWorked: number; totalOtHours: number;
    totalBasePay: number; totalOtPay: number; totalGrossPay: number;
  }>();

  for (const p of payrolls) {
    for (const site of (p.siteBreakdowns || [])) {
      const existing = siteMap.get(site.siteId) || {
        siteId: site.siteId, siteName: site.siteName,
        totalWorkers: 0, totalDaysWorked: 0, totalOtHours: 0,
        totalBasePay: 0, totalOtPay: 0, totalGrossPay: 0,
      };
      existing.totalWorkers += 1;
      existing.totalDaysWorked += site.daysWorked || 0;
      existing.totalOtHours += site.otHours || 0;
      existing.totalBasePay += site.regularPay || 0;
      existing.totalOtPay += site.otPay || 0;
      existing.totalGrossPay += site.totalPay || 0;
      siteMap.set(site.siteId, existing);
    }
  }

  return Array.from(siteMap.values()).sort((a, b) => b.totalGrossPay - a.totalGrossPay);
}

/**
 * Get grand payroll summary for a week (for payroll page totals section)
 * Returns overall summary from stored payroll records
 */
export async function getGrandPayrollSummary(weekStartDate: string) {
  const payrolls = await getPayrollsForWeek(weekStartDate);

  const summary = {
    totalWorkers: 0, totalDaysWorked: 0, totalOtHours: 0,
    totalBasePay: 0, totalOtPay: 0, totalGrossSalary: 0,
    totalAdvanceDeductions: 0, totalLoanDeductions: 0,
    totalOtherDeductions: 0, finalPayrollTotal: 0,
  };

  for (const p of payrolls) {
    summary.totalWorkers++;
    summary.totalDaysWorked += p.daysWorked || 0;
    summary.totalOtHours += p.overtimeHours || 0;
    summary.totalBasePay += p.regularEarnings || 0;
    summary.totalOtPay += p.overtimeEarnings || 0;
    summary.totalGrossSalary += p.totalEarnings || 0;
    summary.totalAdvanceDeductions += p.advances?.reduce((s, a) => s + a.amount, 0) || 0;
    summary.totalLoanDeductions += p.loanDeductions?.reduce((s, l) => s + l.emiAmount, 0) || 0;
    summary.totalOtherDeductions += p.otherDeductions?.reduce((s, o) => s + o.amount, 0) || 0;
    summary.finalPayrollTotal += p.netPay || 0;
  }

  return summary;
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

