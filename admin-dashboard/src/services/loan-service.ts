/**
 * =====================================================
 * LOAN SERVICE
 * =====================================================
 * Data operations for employee loan management.
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
import { auditAction } from './audit-service';
import { COLLECTIONS, PAYROLL_CONFIG } from '@/constants';
import type { 
  Loan, 
  LoanStatus,
  LoanPayment,
  PaginatedResponse, 
  PaginationParams,
} from '@/types';

/**
 * Get loan by ID
 */
export async function getLoan(loanId: string): Promise<Loan | null> {
  return getDocument<Loan>(COLLECTIONS.LOANS, loanId);
}

/**
 * Get all pending loan requests
 */
export async function getPendingLoans(): Promise<Loan[]> {
  const results = await getDocuments<Loan>(COLLECTIONS.LOANS, [
    where('status', '==', 'pending'),
  ]);
  return results.sort((a, b) => {
    const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
    const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
    return aTime - bTime;
  });
}

/**
 * Get active loans
 */
export async function getActiveLoans(): Promise<Loan[]> {
  const results = await getDocuments<Loan>(COLLECTIONS.LOANS, [
    where('status', '==', 'active'),
  ]);
  return results.sort((a, b) => {
    const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
    const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
    return bTime - aTime;
  });
}

/**
 * Get loans for an employee
 */
export async function getEmployeeLoans(employeeId: string): Promise<Loan[]> {
  const results = await getDocuments<Loan>(COLLECTIONS.LOANS, [
    where('employeeId', '==', employeeId),
  ]);
  return results.sort((a, b) => {
    const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
    const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
    return bTime - aTime;
  });
}

/**
 * Get active loan for an employee
 */
export async function getEmployeeActiveLoan(employeeId: string): Promise<Loan | null> {
  const loans = await getDocuments<Loan>(COLLECTIONS.LOANS, [
    where('employeeId', '==', employeeId),
    where('status', '==', 'active'),
  ]);
  
  return loans.length > 0 ? loans[0] : null;
}

/**
 * Get loans with pagination
 */
export async function getLoansPaginated(
  params: PaginationParams,
  filters?: {
    employeeId?: string;
    status?: LoanStatus;
  }
): Promise<PaginatedResponse<Loan>> {
  const constraints = [];

  if (filters?.employeeId) {
    constraints.push(where('employeeId', '==', filters.employeeId));
  }
  
  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  return getPaginatedDocuments<Loan>(
    COLLECTIONS.LOANS,
    params,
    constraints
  );
}

/**
 * Create a new loan request
 */
export async function createLoanRequest(
  data: {
    employeeId: string;
    employeeName: string;
    principalAmount: number;
    totalEmis: number;
    reason: string;
  }
): Promise<string> {
  // Validate amount
  if (data.principalAmount <= 0) {
    throw new Error('Amount must be greater than 0');
  }
  
  // Validate EMIs
  if (data.totalEmis <= 0 || data.totalEmis > PAYROLL_CONFIG.MAX_LOAN_EMIS) {
    throw new Error(`EMIs must be between 1 and ${PAYROLL_CONFIG.MAX_LOAN_EMIS}`);
  }
  
  // Check for existing active loan
  const activeLoan = await getEmployeeActiveLoan(data.employeeId);
  
  if (activeLoan) {
    throw new Error('Employee already has an active loan');
  }
  
  // Check for pending loan requests
  const pendingLoans = await getDocuments<Loan>(COLLECTIONS.LOANS, [
    where('employeeId', '==', data.employeeId),
    where('status', '==', 'pending'),
  ]);
  
  if (pendingLoans.length > 0) {
    throw new Error('There is already a pending loan request');
  }
  
  // Calculate loan details
  const interestRate = PAYROLL_CONFIG.DEFAULT_INTEREST_RATE;
  const totalAmount = data.principalAmount * (1 + interestRate / 100);
  const emiAmount = Math.ceil(totalAmount / data.totalEmis);
  
  const loanData: Omit<Loan, 'id' | 'createdAt' | 'updatedAt'> = {
    employeeId: data.employeeId,
    employeeName: data.employeeName,
    principalAmount: data.principalAmount,
    interestRate,
    totalAmount,
    emiAmount,
    totalEmis: data.totalEmis,
    paidEmis: 0,
    remainingAmount: totalAmount,
    reason: data.reason,
    status: 'pending',
    payments: [],
  };
  
  const id = await createDocument<Loan>(COLLECTIONS.LOANS, loanData as any);
  await auditAction('create', 'loans', id, { newValue: { employeeId: data.employeeId } });
  return id;
}

/**
 * Approve a loan request
 */
export async function approveLoan(
  loanId: string,
  approvedBy: string
): Promise<void> {
  const loan = await getLoan(loanId);
  
  if (!loan) {
    throw new Error('Loan not found');
  }
  
  if (loan.status !== 'pending') {
    throw new Error('Loan is not pending');
  }
  
  await updateDocument<Loan>(COLLECTIONS.LOANS, loanId, {
    status: 'approved',
    approvedBy,
    approvedAt: new Date(),
  });
  await auditAction('approve', 'loans', loanId, { newValue: { action: 'approveLoan' } });
}

/**
 * Disburse an approved loan
 */
export async function disburseLoan(loanId: string): Promise<void> {
  const loan = await getLoan(loanId);
  
  if (!loan) {
    throw new Error('Loan not found');
  }
  
  if (loan.status !== 'approved') {
    throw new Error('Loan must be approved before disbursement');
  }
  
  await updateDocument<Loan>(COLLECTIONS.LOANS, loanId, {
    status: 'active',
    disbursedAt: new Date(),
  });
  await auditAction('update', 'loans', loanId, { newValue: { action: 'disburseLoan' } });
}

/**
 * Reject a loan request
 */
export async function rejectLoan(
  loanId: string,
  reason: string
): Promise<void> {
  const loan = await getLoan(loanId);
  
  if (!loan) {
    throw new Error('Loan not found');
  }
  
  if (loan.status !== 'pending') {
    throw new Error('Loan is not pending');
  }
  
  if (!reason) {
    throw new Error('Rejection reason is required');
  }
  
  await updateDocument<Loan>(COLLECTIONS.LOANS, loanId, {
    status: 'cancelled',
  });
  await auditAction('reject', 'loans', loanId, { newValue: { action: 'rejectLoan' } });
}

/**
 * Record a loan payment (EMI)
 */
export async function recordLoanPayment(
  loanId: string,
  payrollId: string,
  amount?: number
): Promise<void> {
  // Single implementation lives in payroll-service (idempotent, transactional).
  const { recordLoanInstalment } = await import('./payroll-service');
  const loan = await getLoan(loanId);
  if (!loan) throw new Error('Loan not found');
  if (loan.status !== 'active') throw new Error('Loan is not active');
  await recordLoanInstalment(loanId, payrollId, amount ?? loan.emiAmount);
}

/**
 * Get loans due for deduction in payroll
 */
export async function getLoansDueForDeduction(): Promise<Loan[]> {
  return getDocuments<Loan>(COLLECTIONS.LOANS, [
    where('status', '==', 'active'),
  ]);
}

/**
 * Get loan statistics
 */
export async function getLoanStats(): Promise<{
  pending: number;
  active: number;
  completed: number;
  totalDisbursed: number;
  totalOutstanding: number;
}> {
  const loans = await getDocuments<Loan>(COLLECTIONS.LOANS);
  
  const pending = loans.filter(l => l.status === 'pending');
  const active = loans.filter(l => l.status === 'active');
  const completed = loans.filter(l => l.status === 'completed');
  
  return {
    pending: pending.length,
    active: active.length,
    completed: completed.length,
    totalDisbursed: [...active, ...completed].reduce((sum, l) => sum + l.principalAmount, 0),
    totalOutstanding: active.reduce((sum, l) => sum + l.remainingAmount, 0),
  };
}

/**
 * Calculate loan schedule
 */
export function calculateLoanSchedule(
  principalAmount: number,
  interestRate: number,
  totalEmis: number
): {
  totalAmount: number;
  emiAmount: number;
  schedule: Array<{
    emiNumber: number;
    amount: number;
    remainingBalance: number;
  }>;
} {
  const totalAmount = principalAmount * (1 + interestRate / 100);
  const emiAmount = Math.ceil(totalAmount / totalEmis);
  
  const schedule = [];
  let remainingBalance = totalAmount;
  
  for (let i = 1; i <= totalEmis; i++) {
    const amount = i === totalEmis ? remainingBalance : emiAmount;
    remainingBalance -= amount;
    
    schedule.push({
      emiNumber: i,
      amount,
      remainingBalance: Math.max(0, remainingBalance),
    });
  }
  
  return {
    totalAmount,
    emiAmount,
    schedule,
  };
}
