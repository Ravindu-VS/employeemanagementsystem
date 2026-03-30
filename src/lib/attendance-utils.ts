/**
 * Attendance utility functions for role-aware behavior
 */

/**
 * Check if a role is a supervisor (can visit multiple sites in one day)
 * Supervisor roles: owner, ceo, manager, supervisor
 */
export function isSupervisorRole(role?: string): boolean {
  return ['owner', 'ceo', 'manager', 'supervisor'].includes((role || '').toLowerCase());
}

/**
 * Check if a role is a labor worker (limited to one shift per site)
 * Labor roles: bass, helper, draughtsman
 */
export function isLaborRole(role?: string): boolean {
  return ['bass', 'helper', 'draughtsman'].includes((role || '').toLowerCase());
}
