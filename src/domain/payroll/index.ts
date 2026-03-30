import { UserProfile, SimpleAttendance } from "@/types";
import { isHigherRoleMultiSite } from "../roles";
import { calculateDayFraction, extractOtHours, calculateTotalOtHours } from "../attendance";

export function calculateOtRate(dailyRate: number): number {
  if (!dailyRate || dailyRate < 0) return 0;
  return dailyRate / 8;
}

export function calculateOtPay(dailyRate: number, otHours: number): number {
  if (!dailyRate || !otHours || dailyRate < 0 || otHours < 0) return 0;
  return calculateOtRate(dailyRate) * otHours;
}

export function calculateBasePay(dailyRate: number, dayFraction: number, role: string): number {
  if (!dailyRate || !dayFraction || dailyRate < 0 || dayFraction < 0) return 0;
  // Note: For multi-site roles, dayFraction is the number of sites visited
  // The daily rate means "rate per site" for higher roles. Our calculateDayFraction guarantees `dayFraction = number of sites visited`.
  return dailyRate * dayFraction;
}

export function calculatePayrollBreakdown(
  worker: UserProfile,
  records: SimpleAttendance[],
  advanceTotal: number
) {
  let grossPay = 0;
  let totalOtHours = 0;
  let totalDaysOrSites = 0;
  let totalNormalPay = 0;
  let totalOtPay = 0;

  for (const record of records) {
    const fraction = calculateDayFraction(record);
    const dateOt = calculateTotalOtHours(record);

    totalDaysOrSites += fraction;
    totalOtHours += dateOt;

    const basePay = calculateBasePay(worker.dailyRate, fraction, worker.role);
    const otPay = calculateOtPay(worker.dailyRate, dateOt);

    totalNormalPay += basePay;
    totalOtPay += otPay;
  }

  grossPay = totalNormalPay + totalOtPay;
  const finalSalary = Math.max(0, grossPay - advanceTotal);

  return {
    baseRate: worker.dailyRate,
    totalDaysOrSites,
    totalOtHours,
    totalNormalPay,
    totalOtPay,
    grossPay,
    advanceDeduction: advanceTotal,
    finalSalary,
  };
}

