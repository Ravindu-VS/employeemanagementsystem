/**
 * =====================================================
 * ADVANCE GROUPING & DEDUCTION HELPERS
 * =====================================================
 * Utilities for grouping advances and calculating deductions.
 * Extracted from payroll/page.tsx for reusability.
 */

import { AdvanceRequest } from "@/types";

/**
 * Group advances by employee ID
 * Converts AdvanceRequest[] to Map<employeeId, Advance[]>
 */
export function groupAdvancesByEmployee(
  pendingAdvances: AdvanceRequest[]
): Map<string, any[]> {
  const map = new Map<string, any[]>();

  pendingAdvances.forEach((adv: AdvanceRequest) => {
    // Adapt AdvanceRequest to Advance interface for compatibility
    const mappedAdvance = {
      id: adv.id,
      workerId: adv.employeeId,
      amount: adv.amount,
      date: adv.requestedAt
        ? new Date(adv.requestedAt).toISOString()
        : new Date().toISOString(),
      reason: adv.reason || "No reason provided",
      deducted: adv.isDeducted,
      deductionWeek: adv.deductionWeek || null,
      createdAt:
        adv.createdAt instanceof Date ? adv.createdAt : new Date(),
    };

    const list = map.get(adv.employeeId) || [];
    list.push(mappedAdvance);
    map.set(adv.employeeId, list);
  });

  return map;
}

/**
 * Calculate total advance deductions based on user selections
 * Takes a deductionSelections map (advanceId -> boolean) and sums matching amounts
 */
export function calculateSelectedAdvanceDeductions(
  employeeSummaries: any[], // TODO: type as EmployeePayrollSummary[]
  deductionSelections: Record<string, boolean>
): number {
  let totalDeductions = 0;

  for (const emp of employeeSummaries) {
    for (const adv of emp.advances || []) {
      if (deductionSelections[adv.id]) {
        totalDeductions += adv.amount;
      }
    }
  }

  return totalDeductions;
}

/**
 * Get selected advance IDs from deduction selections
 */
export function getSelectedAdvanceIds(
  deductionSelections: Record<string, boolean>
): string[] {
  return Object.entries(deductionSelections)
    .filter(([_, isSelected]) => isSelected)
    .map(([advanceId, _]) => advanceId);
}

/**
 * Calculate advance deduction for a specific employee
 * based on which advances they have selected for deduction
 */
export function calculateEmployeeAdvanceDeduction(
  employeeAdvances: any[], // Advance[]
  deductionSelections: Record<string, boolean>
): number {
  return employeeAdvances.reduce(
    (sum, adv) => sum + (deductionSelections[adv.id] ? adv.amount : 0),
    0
  );
}
