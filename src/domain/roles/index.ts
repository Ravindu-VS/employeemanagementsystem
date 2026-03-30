import { UserRole, UserProfile } from "@/types";

/**
 * Defines which roles are considered "Higher Management" or "Supervisors".
 * They have multi-site attendance capabilities.
 */
export const HIGHER_ROLES = ["owner", "ceo", "manager", "supervisor"] as const;

/**
 * Defines which roles are considered "Labor".
 * They have half-day (morning/evening) attendance logic.
 */
export const LABOR_ROLES = ["draughtsman", "bass", "helper"] as const;

/**
 * Checks if a role requires higher-role multi-site attendance.
 */
export function isHigherRoleMultiSite(role?: string | UserRole): boolean {
  if (!role) return false;
  const normalized = role.trim().toLowerCase();
  return HIGHER_ROLES.includes(normalized as any);
}

/**
 * Checks if a role is a labor role (half-day attendance).
 */
export function isLaborHalfDayRole(role?: string | UserRole): boolean {
  if (!role) return false;
  const normalized = role.trim().toLowerCase();
  return LABOR_ROLES.includes(normalized as any);
}

/**
 * Resolves the effective role for an employee, accommodating legacy data fields
 * (like designation or position) if the standard "role" field is missing.
 */
export function resolveEffectiveRole(worker: Partial<UserProfile> | any): string {
  if (!worker) return "helper"; // safe default
  
  // Clean checks
  if (worker.role) return worker.role.trim().toLowerCase();
  if (worker.designation) return worker.designation.trim().toLowerCase();
  if (worker.position) return worker.position.trim().toLowerCase();
  
  return "helper";
}

