import { format, parseISO, isValid } from "date-fns";
import { formatCurrency } from "@/lib/utils";

/**
 * Formats a number into LKR Currency format.
 * DEPRECATED: Use formatCurrency from @/lib/utils directly.
 * This is kept for backward compatibility and re-exports the canonical formatCurrency.
 */
export function formatLkr(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return formatCurrency(0);
  }
  return formatCurrency(amount);
}

/**
 * Safely format a date for Sri Lanka standard view.
 */
export function formatSriLankaDate(dateString: string | undefined | null): string {
  if (!dateString) return "N/A";
  try {
    const parsed = typeof dateString === "string" ? parseISO(dateString) : new Date(dateString);
    if (!isValid(parsed)) return "Invalid Date";
    return format(parsed, "yyyy MMM dd");
  } catch (err) {
    return "Invalid Date";
  }
}

