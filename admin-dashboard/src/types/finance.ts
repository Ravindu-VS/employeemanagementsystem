/**
 * =====================================================
 * FINANCE TYPES (Advances & Loans)
 * =====================================================
 */

import type { UserRole } from './user';

export interface Advance {
  id: string;
  workerId: string;
  amount: number;
  date: string;
  reason: string;
  deducted: boolean;
  deductionWeek: string | null;
  createdBy?: string;
  createdAt?: Date;
}

/**
 * Advance status for carry-forward workflow
 */
export type AdvanceState = 
  | 'approved'
  | 'partially_deducted'
  | 'fully_deducted'
  | 'carried_forward';

/**
 * Salary advance request
 *
 * Business Rules:
 * - status: "pending" (awaiting approval) → "approved" (eligible) → "rejected" (hidden)
 * - deducted: false (eligible for payroll) → true (already deducted, hidden from future weeks)
 * - deductionWeek: which week it was deducted (audit trail)
 */
export interface AdvanceRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  reason: string;
  requestedAt: Date;
  status: RequestStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  deductThisWeek: boolean;      // true = deduct from current payroll
  deductionWeek?: string;       // YYYY-MM-DD week for future deduction
  deductionWeekId?: string;     // Week when actually deducted (legacy)
  deductedWeek?: string;        // Week when actually deducted (YYYY-MM-DD)
  deducted?: boolean;           // legacy duplicate of isDeducted (both are written)
  advanceDate?: string;         // yyyy-MM-dd (Colombo) date the money was given
  deductedInPayrollId?: string;
  isDeducted: boolean;
  carryForward: boolean;        // true = carried forward, not deducted
  advanceState?: AdvanceState;  // Current state in the carry-forward workflow
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Employee loan
 */
export interface Loan {
  id: string;
  employeeId: string;
  employeeName: string;
  principalAmount: number;
  interestRate: number; // percentage
  totalAmount: number;
  emiAmount: number;
  totalEmis: number;
  paidEmis: number;
  remainingAmount: number;
  reason: string;
  status: LoanStatus;
  approvedBy?: string;
  approvedAt?: Date;
  disbursedAt?: Date;
  completedAt?: Date;
  payments: LoanPayment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LoanPayment {
  id: string;
  emiNumber: number;
  amount: number;
  payrollId: string;
  paidAt: Date;
}

export type RequestStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type LoanStatus = 
  | 'pending'
  | 'approved'
  | 'active'
  | 'completed'
  | 'defaulted'
  | 'cancelled';
