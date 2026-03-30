/**
 * =====================================================
 * PAYROLL ENGINE
 * =====================================================
 * Multi-site payroll calculation and aggregation.
 * Pure functions - no Firebase calls.
 */

import { calculateOtHourlyRate } from '../salary-utils';

/**
 * Single site breakdown for a worker
 */
export interface SiteCalculation {
  siteId: string;
  siteName: string;
  daysWorked: number;
  otHours: number;
  basePay: number;
  otPay: number;
  totalPay: number;
}

/**
 * Worker payroll across all sites
 */
export interface WorkerPayrollCalculation {
  workerId: string;
  workerName: string;
  dailyRate: number;
  computedOtRate: number;
  sites: SiteCalculation[];
  totalDaysWorked: number;
  totalOtHours: number;
  totalBasePay: number;
  totalOtPay: number;
  grossPay: number;
  advanceDeduction: number;
  loanDeduction: number;
  otherDeduction: number;
  finalPay: number;
}

/**
 * Site payroll totals
 */
export interface SitePayrollSummary {
  siteId: string;
  siteName: string;
  workerCount: number;
  totalDaysWorked: number;
  totalOtHours: number;
  totalBasePay: number;
  totalOtPay: number;
  totalSalary: number;
}

/**
 * Overall payroll summary
 */
export interface PayrollSummary {
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
}

/**
 * Calculate payroll for a single site breakdown
 */
export function calculateSiteBreakdown(
  siteId: string,
  siteName: string,
  daysWorked: number,
  otHours: number,
  dailyRate: number
): SiteCalculation {
  const otRate = calculateOtHourlyRate(dailyRate);
  const basePay = daysWorked * dailyRate;
  const otPay = otHours * otRate;

  return {
    siteId,
    siteName,
    daysWorked,
    otHours,
    basePay,
    otPay,
    totalPay: basePay + otPay,
  };
}

/**
 * Aggregate worker payroll across all sites
 */
export function aggregateWorkerPayroll(
  workerId: string,
  workerName: string,
  dailyRate: number,
  sites: SiteCalculation[],
  advanceDeduction: number = 0,
  loanDeduction: number = 0,
  otherDeduction: number = 0
): WorkerPayrollCalculation {
  const otRate = calculateOtHourlyRate(dailyRate);

  const totalDaysWorked = sites.reduce((sum, s) => sum + s.daysWorked, 0);
  const totalOtHours = sites.reduce((sum, s) => sum + s.otHours, 0);
  const totalBasePay = sites.reduce((sum, s) => sum + s.basePay, 0);
  const totalOtPay = sites.reduce((sum, s) => sum + s.otPay, 0);
  const grossPay = totalBasePay + totalOtPay;

  return {
    workerId,
    workerName,
    dailyRate,
    computedOtRate: otRate,
    sites,
    totalDaysWorked,
    totalOtHours,
    totalBasePay,
    totalOtPay,
    grossPay,
    advanceDeduction,
    loanDeduction,
    otherDeduction,
    finalPay: Math.max(0, grossPay - advanceDeduction - loanDeduction - otherDeduction),
  };
}

/**
 * Aggregate payroll by site
 */
export function aggregateSitePayroll(
  workers: WorkerPayrollCalculation[]
): SitePayrollSummary[] {
  const siteMap = new Map<string, SitePayrollSummary>();

  for (const worker of workers) {
    for (const site of worker.sites) {
      const existing = siteMap.get(site.siteId) || {
        siteId: site.siteId,
        siteName: site.siteName,
        workerCount: 0,
        totalDaysWorked: 0,
        totalOtHours: 0,
        totalBasePay: 0,
        totalOtPay: 0,
        totalSalary: 0,
      };

      existing.workerCount += 1;
      existing.totalDaysWorked += site.daysWorked;
      existing.totalOtHours += site.otHours;
      existing.totalBasePay += site.basePay;
      existing.totalOtPay += site.otPay;
      existing.totalSalary += site.totalPay;

      siteMap.set(site.siteId, existing);
    }
  }

  return Array.from(siteMap.values()).sort((a, b) =>
    b.totalSalary - a.totalSalary
  );
}

/**
 * Calculate overall payroll summary
 */
export function calculateOverallPayroll(
  workers: WorkerPayrollCalculation[]
): PayrollSummary {
  const totalWorkers = workers.length;
  const totalDaysWorked = workers.reduce((sum, w) => sum + w.totalDaysWorked, 0);
  const totalOtHours = workers.reduce((sum, w) => sum + w.totalOtHours, 0);
  const totalBasePay = workers.reduce((sum, w) => sum + w.totalBasePay, 0);
  const totalOtPay = workers.reduce((sum, w) => sum + w.totalOtPay, 0);
  const totalGrossSalary = workers.reduce((sum, w) => sum + w.grossPay, 0);
  const totalAdvanceDeductions = workers.reduce((sum, w) => sum + w.advanceDeduction, 0);
  const totalLoanDeductions = workers.reduce((sum, w) => sum + w.loanDeduction, 0);
  const totalOtherDeductions = workers.reduce((sum, w) => sum + w.otherDeduction, 0);

  return {
    totalWorkers,
    totalDaysWorked,
    totalOtHours,
    totalBasePay,
    totalOtPay,
    totalGrossSalary,
    totalAdvanceDeductions,
    totalLoanDeductions,
    totalOtherDeductions,
    finalPayrollTotal: totalGrossSalary - totalAdvanceDeductions - totalLoanDeductions - totalOtherDeductions,
  };
}
