/**
 * =====================================================
 * PAYROLL TYPES
 * =====================================================
 */

import type { UserRole } from './user';
import type { AdvanceRequest } from './finance';

/**
 * Weekly payroll record
 */
export interface WeeklyPayroll {
  id: string;
  weekStartDate: string; // YYYY-MM-DD (Monday)
  weekEndDate: string;   // YYYY-MM-DD (Sunday)
  employeeId: string;
  employeeName: string;
  employeeRole: UserRole;
  
  // Hours
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  daysWorked: number;
  
  // Earnings
  regularEarnings: number;
  overtimeEarnings: number;
  transportAllowance?: number;
  transportBasis?: string;
  /** Stored by the payroll engine (v2) at approval time */
  workerId?: string;
  dailyRate?: number;
  otRate?: number;
  siteVisits?: number;
  advancesCarriedForward?: Array<{ advanceId: string; amount: number; date?: string }>;
  anomalies?: string[];
  bonuses: BonusEntry[];
  totalEarnings: number;
  
  // Per-site breakdown (added for multi-site support)
  siteBreakdowns?: SiteBreakdown[];
  
  // Deductions
  advances: AdvanceDeduction[];
  loanDeductions: LoanDeduction[];
  otherDeductions: OtherDeduction[];
  totalDeductions: number;
  
  // Final
  netPay: number;
  status: PayrollStatus;
  
  // Metadata
  generatedAt: Date;
  generatedBy: string;
  approvedAt?: Date;
  approvedBy?: string;
  paidAt?: Date;
  paymentMethod?: PaymentMethod;
  payslipUrl?: string;
  
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BonusEntry {
  id: string;
  type: string;
  description: string;
  amount: number;
  approvedBy: string;
  approvedAt: Date;
}

export interface AdvanceDeduction {
  advanceId: string;
  amount: number;
  description: string;
}

export interface LoanDeduction {
  loanId: string;
  emiAmount: number;
  emiNumber: number;
  totalEmis: number;
  remainingAmount?: number;
}

export interface OtherDeduction {
  id: string;
  type: string;
  description: string;
  amount: number;
}

export type PayrollStatus = 
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'paid'
  | 'cancelled';

export type PaymentMethod = 
  | 'cash'
  | 'bank_transfer'
  | 'cheque'
  | 'upi';

// =====================================================
// PER-SITE PAYROLL TYPES
// =====================================================

/**
 * Breakdown of one worker's attendance & pay at a single site
 */
export interface SiteBreakdown {
  siteId: string;
  siteName: string;
  daysWorked: number;   // 0.5 increments (morning/evening)
  otHours: number;
  regularPay: number;   // daysWorked × dailyRate
  otPay: number;        // otHours × otRate
  totalPay: number;     // regularPay + otPay
}

/**
 * Full payroll summary for one worker (across all sites)
 * This is the CANONICAL type used across the entire system.
 * Replaces both the old WorkerPayrollSummary and EmployeePayrollSummary.
 */
export interface WorkerPayrollSummary {
  workerId: string;
  workerName: string;
  workerRole: UserRole;
  dailyRate: number;
  otRate: number;        // DERIVED: dailyRate / 8 (not stored)
  siteBreakdowns: SiteBreakdown[];
  totalDays: number;
  totalOtHours: number;
  grossSalary: number;
  advances: AdvanceRequest[];   // un-deducted advances
  totalAdvanceDeduction: number;
  finalSalary: number;
}

/**
 * Aggregated payroll total for one site
 */
export interface SitePayrollTotal {
  siteId: string;
  siteName: string;
  totalPayroll: number;
  workerCount: number;
}

/**
 * Complete payroll report with workers, site totals, and grand total
 */
export interface PayrollReport {
  workers: WorkerPayrollSummary[];
  siteTotals: SitePayrollTotal[];
  grandTotal: number;
}

/**
 * Worker weekly payroll with advance/loan deductions
 */
export interface WorkerWeeklyPayroll {
  workerId: string;
  workerName: string;
  role: string;
  grossPay: number;
  pendingAdvances: import('./finance').Advance[];
  selectedAdvanceDeductions: import('./finance').Advance[];
  advanceDeductionTotal: number;
  loanDeduction: number;
  finalPay: number;
}

/**
 * Final payroll summary totals
 */
export interface FinalPayrollSummary {
  totalWorkers: number;
  totalDaysWorked: number;
  totalOtHours: number;
  totalBasePay: number;
  totalOtPay: number;
  totalGrossPay: number;
  totalAdvanceDeductions: number;
  totalLoanDeductions: number;
  finalPayrollTotal: number;
}
