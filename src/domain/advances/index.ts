import { Advance } from "@/types";

/**
 * Filter an array of advances to return only the ones not definitively fully paid/deducted.
 */
export function getPendingAdvances(advances: Advance[]): Advance[] {
  return (advances || []).filter(adv => !adv.deducted);
}

/**
 * Calculates the total deduction to apply from a provided list of advances.
 * Typically receives only the advances explicitly selected for deduction in the UI.
 */
export function calculateAdvanceDeductionTotal(selectedAdvances: Advance[]): number {
  return (selectedAdvances || []).reduce((acc, curr) => {
    // Optionally respect curr.deductionAmount if partial deduction is supported, 
    // otherwise fallback to full amount. 
    return acc + Number(curr.amount || 0);
  }, 0);
}

