import type { UserRole } from "@/types";

/**
 * Defines which roles are considered "Higher Management" or "Supervisors".
 * They have multi-site attendance capabilities.
 */
export const HIGHER_ROLES = ["owner", "ceo", "manager", "supervisor"] as const;

/** Drivers: no site, daily salary by morning/evening shift. */
export const DRIVER_ROLES = ["driver"] as const;

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

// =====================================================
// ACCESS MATRIX (UI). Mirrored server-side in firestore.rules —
// hiding a menu item is never the only protection.
// =====================================================
export type AppArea =
  | 'dashboard' | 'approvals' | 'employees' | 'employees_manage' | 'sites' | 'attendance'
  | 'payroll' | 'advances' | 'loans' | 'transport' | 'reports' | 'settings' | 'audit_logs' | 'roles_assign'
  | 'leave' | 'leave_approve';

const ALL: UserRole[] = ['owner', 'ceo', 'manager', 'supervisor', 'draughtsman', 'bass', 'helper', 'driver'];
const ADMIN: UserRole[] = ['owner', 'ceo'];
const PAYROLL_ADMIN: UserRole[] = ['owner', 'ceo', 'manager'];
const ATTENDANCE_MARKERS: UserRole[] = ['owner', 'ceo', 'manager', 'supervisor'];

export const ACCESS_MATRIX: Record<AppArea, UserRole[]> = {
  dashboard: ALL,
  approvals: ADMIN,
  employees: ATTENDANCE_MARKERS,      // supervisors see the team list (read-only)
  employees_manage: PAYROLL_ADMIN,    // create / edit / deactivate
  roles_assign: ADMIN,                // only Owner/CEO assign or change roles
  sites: PAYROLL_ADMIN,
  attendance: ATTENDANCE_MARKERS,
  payroll: PAYROLL_ADMIN,
  advances: PAYROLL_ADMIN,
  loans: PAYROLL_ADMIN,
  transport: PAYROLL_ADMIN,
  reports: PAYROLL_ADMIN,
  settings: ADMIN,
  audit_logs: ADMIN,
  leave: ALL,                         // everyone can request leave
  leave_approve: PAYROLL_ADMIN,
};

export function canAccess(role: UserRole | string | null | undefined, area: AppArea): boolean {
  return !!role && ACCESS_MATRIX[area].includes(role as UserRole);
}
