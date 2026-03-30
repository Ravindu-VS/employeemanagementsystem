/**
 * =====================================================
 * LOAN CALCULATION UTILITIES
 * =====================================================
 * Core logic for loan EMI calculations and payment tracking.
 */

import { Loan, LoanPayment } from "@/types";

/**
 * Calculate EMI (Equated Monthly Installment) for a loan
 * Formula: EMI = [P * r * (1 + r)^n] / [(1 + r)^n - 1]
 * Where: P = principal, r = monthly rate, n = number of months
 */
export function calculateEMI(
  principalAmount: number,
  annualInterestRate: number,
  durationMonths: number
): number {
  if (durationMonths <= 0 || principalAmount <= 0) return 0;

  const monthlyRate = annualInterestRate / 100 / 12;

  if (monthlyRate === 0) {
    // Simple division if no interest
    return principalAmount / durationMonths;
  }

  const numerator =
    principalAmount *
    monthlyRate *
    Math.pow(1 + monthlyRate, durationMonths);
  const denominator = Math.pow(1 + monthlyRate, durationMonths) - 1;

  return numerator / denominator;
}

/**
 * Calculate total amount to be paid (principal + interest)
 */
export function calculateTotalLoanAmount(
  principalAmount: number,
  annualInterestRate: number,
  durationMonths: number
): number {
  const emi = calculateEMI(principalAmount, annualInterestRate, durationMonths);
  return emi * durationMonths;
}

/**
 * Calculate interest amount only
 */
export function calculateLoanInterest(
  principalAmount: number,
  annualInterestRate: number,
  durationMonths: number
): number {
  return (
    calculateTotalLoanAmount(
      principalAmount,
      annualInterestRate,
      durationMonths
    ) - principalAmount
  );
}

/**
 * Get next EMI number for a loan
 */
export function getNextEMINumber(loan: Loan): number {
  return loan.paidEmis + 1;
}

/**
 * Calculate remaining EMIs
 */
export function getRemainingEMIs(loan: Loan): number {
  return Math.max(0, loan.totalEmis - loan.paidEmis);
}

/**
 * Check if loan is fully paid
 */
export function isLoanFullyPaid(loan: Loan): boolean {
  return loan.paidEmis >= loan.totalEmis;
}

/**
 * Calculate remaining loan amount after a payment
 */
export function calculateRemainingAmount(
  loan: Loan,
  newPaymentAmount?: number
): number {
  const paidAmount = loan.payments.reduce((sum, p) => sum + p.amount, 0);
  const additionalPayment = newPaymentAmount || 0;
  return Math.max(0, loan.principalAmount - paidAmount - additionalPayment);
}

/**
 * Calculate progress percentage
 */
export function calculateLoanProgress(loan: Loan): number {
  if (loan.totalEmis === 0) return 0;
  return (loan.paidEmis / loan.totalEmis) * 100;
}

/**
 * Validate loan before processing
 */
export interface LoanValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateLoan(loan: Loan): LoanValidationResult {
  const errors: string[] = [];

  if (loan.principalAmount <= 0) {
    errors.push("Principal amount must be positive");
  }

  if (loan.interestRate < 0) {
    errors.push("Interest rate cannot be negative");
  }

  if (loan.totalEmis <= 0) {
    errors.push("Total EMIs must be positive");
  }

  if (loan.emiAmount <= 0) {
    errors.push("EMI amount must be positive");
  }

  if (loan.paidEmis > loan.totalEmis) {
    errors.push("Paid EMIs cannot exceed total EMIs");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
