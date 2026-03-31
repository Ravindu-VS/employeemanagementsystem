/**
 * =====================================================
 * ADVANCE GROUPING & DEDUCTION HELPERS
 * =====================================================
 * 🔥 CRITICAL LOGIC
 * Group advances by employee + calculate deductions
 *
 * KEY RULE: ONLY show advances that are:
 *   ✅ status === "approved"  (pending → hidden, rejected → hidden)
 *   ✅ deducted === false     (already deducted → hidden)
 *
 * These are merged into employee summaries by payroll engine
 *
 * ⚠️ FIRESTORE COMPATIBILITY:
 * Handles both old (isDeducted) and new (deducted) field names
 */

import { AdvanceRequest } from "@/types";

/**
 * Group APPROVED + UN-DEDUCTED advances by employee ID
 *
 * INPUT: All outstanding advances from Firestore
 * FILTERS:
 *   - Status MUST be "approved"
 *   - deducted/isDeducted MUST be false (handles both old & new field names)
 *   - Any pending/rejected advances are EXCLUDED
 *
 * OUTPUT: Map<employeeId, ApprovedAdvances[]>
 *
 * CEO then uses this map to select which to deduct this week
 */
export function groupAdvancesByEmployee(
  pendingAdvances: AdvanceRequest[]
): Map<string, any[]> {
  const map = new Map<string, any[]>();

  if (typeof window !== 'undefined') {
    console.log(`📊 [ADVANCE GROUPING START]`);
    console.log(`   Input: ${pendingAdvances.length} total advances from Firestore`);
  }

  let approvedCount = 0;
  let rejectedCount = 0;
  let deductedCount = 0;

  for (const adv of pendingAdvances) {
    // FILTER 1: Only APPROVED status
    if (adv.status !== 'approved') {
      if (adv.status === 'rejected') rejectedCount++;
      if (typeof window !== 'undefined') {
        console.log(`   ❌ SKIP ${adv.id}: status=${adv.status} (must be 'approved')`);
      }
      continue;
    }

    // FILTER 2: Only UN-DEDUCTED (handle both old & new field names)
    const isDed = (adv as any).isDeducted || (adv as any).deducted || false;
    if (isDed) {
      deductedCount++;
      if (typeof window !== 'undefined') {
        console.log(`   ❌ SKIP ${adv.id}: already deducted on ${(adv as any).deductionWeek || (adv as any).deductionWeekId}`);
      }
      continue;
    }

    approvedCount++;

    // MAP to display format (normalize both old & new field names)
    const mappedAdvance = {
      id: adv.id,
      workerId: adv.employeeId,
      amount: adv.amount,
      date: adv.requestedAt instanceof Date
        ? adv.requestedAt.toISOString()
        : adv.requestedAt,
      reason: adv.reason || 'No reason provided',
      status: adv.status,
      deducted: isDed,
      deductionWeek: (adv as any).deductionWeek || (adv as any).deductionWeekId || null,
    };

    // Group by employeeId
    const list = map.get(adv.employeeId) || [];
    list.push(mappedAdvance);
    map.set(adv.employeeId, list);

    if (typeof window !== 'undefined') {
      console.log(`   ✅ INCLUDE ${adv.id}: emp=${adv.employeeId}, amt=${adv.amount} LKR`);
    }
  }

  if (typeof window !== 'undefined') {
    console.log(`📊 [ADVANCE GROUPING RESULT]`);
    console.log(`   Approved & Un-deducted (SHOWN): ${approvedCount}`);
    console.log(`   Rejected (HIDDEN): ${rejectedCount}`);
    console.log(`   Already Deducted (HIDDEN): ${deductedCount}`);
    console.log(`   Employees with advances: ${map.size}`);
    if (map.size === 0) {
      console.log('   ⚠️ NO ADVANCES TO SHOW - Check that advances are approved!');
    }
  }

  return map;
}

/**
 * 🔥 CRITICAL: Calculate total advance deductions
 *
 * Takes CEO's checkbox selections: advanceId → boolean (true = deduct this week)
 * Sums amounts of checked advances across all employees
 *
 * Only counts advances that CEO explicitly checked
 */
export function calculateSelectedAdvanceDeductions(
  employeeSummaries: any[], // EmployeePayrollSummary[]
  deductionSelections: Record<string, boolean>  // advanceId → isSelected
): number {
  let totalDeductions = 0;

  if (typeof window !== 'undefined') {
    console.log(`📊 [CALC DEDUCTIONS START]`);
    const selectedCount = Object.values(deductionSelections).filter(Boolean).length;
    console.log(`   CEO selected: ${selectedCount} advances for deduction`);
  }

  // For each employee
  for (const emp of employeeSummaries) {
    // For each their un-deducted advances
    for (const adv of emp.advances || []) {
      // Check if CEO marked it for deduction
      if (deductionSelections[adv.id]) {
        totalDeductions += adv.amount;
        if (typeof window !== 'undefined') {
          console.log(`   ✓ ${emp.employeeName}: advance ${adv.id.substring(0, 8)}... = ${adv.amount} LKR`);
        }
      }
    }
  }

  if (typeof window !== 'undefined') {
    console.log(`📊 [CALC DEDUCTIONS RESULT]`);
    console.log(`   Total selected for deduction: ${totalDeductions} LKR`);
  }

  return totalDeductions;
}

/**
 * Extract selected advance IDs from CEO's checkbox selections
 * Used when generating payroll to mark selected advances as deducted
 */
export function getSelectedAdvanceIds(
  deductionSelections: Record<string, boolean>
): string[] {
  return Object.entries(deductionSelections)
    .filter(([_, isSelected]) => isSelected)
    .map(([advanceId, _]) => advanceId);
}

/**
 * Calculate deduction for single employee based on CEO selections
 * Local helper used by WorkerPayrollCard UI
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

// =====================================================
// WEEKLY ADVANCES FILTERING
// =====================================================

/**
 * Check if an advance was created within a specific week (Sunday-Saturday)
 */
export function isDateWithinWeek(
  date: string | Date,
  weekStartISO: string,
  weekEndISO: string
): boolean {
  const advDate = typeof date === 'string' ? date : new Date(date).toISOString().split('T')[0];
  return advDate >= weekStartISO && advDate <= weekEndISO;
}

/**
 * Check if an advance is a carry-forward advance
 * (approved, undeducted, created before the selected week)
 */
export function isCarryForwardAdvance(
  advance: AdvanceRequest,
  weekStartISO: string
): boolean {
  const advDate = typeof advance.requestedAt === 'string'
    ? advance.requestedAt
    : new Date(advance.requestedAt).toISOString().split('T')[0];

  const isDed = (advance as any).isDeducted || advance.deducted || false;

  return (
    advance.status === 'approved' &&
    !isDed &&
    advDate < weekStartISO
  );
}

/**
 * Check if an advance is new for a specific week
 * (approved, undeducted, created within the selected week)
 */
export function isNewAdvanceForWeek(
  advance: AdvanceRequest,
  weekStartISO: string,
  weekEndISO: string
): boolean {
  const advDate = typeof advance.requestedAt === 'string'
    ? advance.requestedAt
    : new Date(advance.requestedAt).toISOString().split('T')[0];

  const isDed = (advance as any).isDeducted || advance.deducted || false;

  return (
    advance.status === 'approved' &&
    !isDed &&
    advDate >= weekStartISO &&
    advDate <= weekEndISO
  );
}

/**
 * Group advances into weekly sections
 * Returns: { thisWeek, carryForward }
 */
export function groupWeeklyAdvances(
  advances: AdvanceRequest[],
  weekStartISO: string,
  weekEndISO: string
): {
  thisWeek: AdvanceRequest[];
  carryForward: AdvanceRequest[];
} {
  const thisWeek: AdvanceRequest[] = [];
  const carryForward: AdvanceRequest[] = [];

  for (const adv of advances) {
    if (isNewAdvanceForWeek(adv, weekStartISO, weekEndISO)) {
      thisWeek.push(adv);
    } else if (isCarryForwardAdvance(adv, weekStartISO)) {
      carryForward.push(adv);
    }
  }

  return { thisWeek, carryForward };
}
