/**
 * =====================================================
 * SALARY CALCULATION UTILITIES
 * =====================================================
 * Centralized calculations for payroll:
 * - OT hourly rate: dailyRate / 8
 * - OT pay: otHours × (dailyRate / 8)
 * - Daily pay: daysWorked × dailyRate
 * - Gross pay: dailyPay + otPay
 *
 * All amounts are in LKR currency (no currency conversion needed).
 */

/**
 * Calculate OT hourly rate from daily salary
 * Formula: dailyRate / 8 (assuming 8-hour work day)
 * @param dailyRate - Daily salary in LKR
 * @returns OT hourly rate in LKR
 */
export function calculateOtHourlyRate(dailyRate: number): number {
  if (dailyRate < 0) return 0;
  return dailyRate / 8;
}

/**
 * Calculate OT pay from hours and daily rate
 * Formula: otHours × (dailyRate / 8)
 * @param dailyRate - Daily salary in LKR
 * @param otHours - Overtime hours worked
 * @returns Total OT pay in LKR
 */
export function calculateOtPay(dailyRate: number, otHours: number): number {
  if (dailyRate < 0 || otHours < 0) return 0;
  const otHourlyRate = calculateOtHourlyRate(dailyRate);
  return otHourlyRate * otHours;
}

/**
 * Calculate daily pay
 * Formula: daysWorked × dailyRate
 * @param daysWorked - Number of days worked
 * @param dailyRate - Daily salary in LKR
 * @returns Total daily pay in LKR
 */
export function calculateDailyPay(daysWorked: number, dailyRate: number): number {
  if (daysWorked < 0 || dailyRate < 0) return 0;
  return daysWorked * dailyRate;
}

/**
 * Calculate gross pay before deductions
 * Formula: dailyPay + otPay
 * @param daysWorked - Number of days worked
 * @param dailyRate - Daily salary in LKR
 * @param otHours - Overtime hours worked
 * @returns Gross pay in LKR
 */
export function calculateGrossPay(
  daysWorked: number,
  dailyRate: number,
  otHours: number
): number {
  const dailyPay = calculateDailyPay(daysWorked, dailyRate);
  const otPay = calculateOtPay(dailyRate, otHours);
  return dailyPay + otPay;
}

/**
 * Calculate final pay after deductions
 * Formula: grossPay - advances - loanDeductions - otherDeductions
 * @param grossPay - Gross pay before deductions
 * @param advanceDeduction - Advance amount deducted
 * @param loanDeduction - Loan EMI deduction
 * @param otherDeduction - Other deductions (taxes, etc)
 * @returns Final net pay in LKR
 */
export function calculateNetPay(
  grossPay: number,
  advanceDeduction: number = 0,
  loanDeduction: number = 0,
  otherDeduction: number = 0
): number {
  return Math.max(0, grossPay - advanceDeduction - loanDeduction - otherDeduction);
}
