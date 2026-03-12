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
import { getEmployeeAttendanceSummary } from './attendance-service';
import { getEmployee } from './employee-service';
import type { 
  WeeklyPayroll, 
  PayrollStatus, 
  PaymentMethod,
  BonusEntry,
  AdvanceDeduction,
  LoanDeduction,
  OtherDeduction,
  PaginatedResponse, 
  PaginationParams,
  UserProfile,
  DateRange,
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
  return getDocuments<WeeklyPayroll>(COLLECTIONS.PAYROLL, [
    where('weekStartDate', '==', weekStartDate),
    orderBy('employeeName', 'asc'),
  ]);
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
    orderBy('weekStartDate', 'desc'),
  ]);
  
  return payrolls.slice(0, limit);
}

/**
 * Generate payroll for an employee for a specific week
 */
export async function generateEmployeePayroll(
  employeeId: string,
  weekStartDate: Date,
  generatedBy: string
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
  
  // Get attendance summary for the week
  const attendanceSummary = await getEmployeeAttendanceSummary(employeeId, {
    start: weekStart,
    end: weekEnd,
  });
  
  // Calculate earnings using dailyRate-based formula per spec:
  // Salary = (daysWorked × dailyRate) + (otHours × otRate) - loanDeduction - advanceDeduction
  const dailyRate = employee.dailyRate || 0;
  const otRate = employee.otRate || 0;
  const daysWorked = attendanceSummary.presentDays + (attendanceSummary.halfDays * 0.5);
  const overtimeHours = attendanceSummary.overtimeHours;
  
  const regularEarnings = daysWorked * dailyRate;
  const overtimeEarnings = overtimeHours * otRate;
  
  // Calculate hours for record keeping
  const regularHours = daysWorked * (PAYROLL_CONFIG.WEEK_START_DAY || 8);
  const totalHours = regularHours + overtimeHours;
  
  // TODO: Get pending advances and loans
  const advances: AdvanceDeduction[] = [];
  const loanDeductions: LoanDeduction[] = [];
  const otherDeductions: OtherDeduction[] = [];
  
  const totalEarnings = regularEarnings + overtimeEarnings;
  const totalDeductions = 
    advances.reduce((sum, a) => sum + a.amount, 0) +
    loanDeductions.reduce((sum, l) => sum + l.emiAmount, 0) +
    otherDeductions.reduce((sum, o) => sum + o.amount, 0);
  
  const netPay = totalEarnings - totalDeductions;
  
  // Create payroll record
  const payrollData: Omit<WeeklyPayroll, 'id' | 'createdAt' | 'updatedAt'> = {
    weekStartDate: weekStartStr,
    weekEndDate: weekEndStr,
    employeeId,
    employeeName: employee.displayName || employee.email,
    employeeRole: employee.role,
    
    regularHours,
    overtimeHours,
    totalHours: regularHours + overtimeHours,
    daysWorked: attendanceSummary.presentDays,
    
    regularEarnings,
    overtimeEarnings,
    bonuses: [],
    totalEarnings,
    
    advances,
    loanDeductions,
    otherDeductions,
    totalDeductions,
    
    netPay,
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
  employeeIds?: string[]
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
      await generateEmployeePayroll(employee.uid, weekStartDate, generatedBy);
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
