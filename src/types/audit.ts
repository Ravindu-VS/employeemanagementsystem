/**
 * =====================================================
 * AUDIT LOG TYPES
 * =====================================================
 */

import type { UserRole } from './user';

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: AuditAction;
  resource: string;
  resourceId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export type AuditAction = 
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'approve'
  | 'reject'
  | 'export'
  | 'user_approved'
  | 'user_rejected'
  | 'advance_deducted'
  | 'advance_carried_forward';

// =====================================================
// AUDIT EVENT TYPES
// =====================================================

export const AUDIT_EVENTS = {
  EMPLOYEE_CREATED: 'EMPLOYEE_CREATED',
  EMPLOYEE_UPDATED: 'EMPLOYEE_UPDATED',
  EMPLOYEE_DELETED: 'EMPLOYEE_DELETED',
  SITE_CREATED: 'SITE_CREATED',
  SITE_UPDATED: 'SITE_UPDATED',
  SITE_DELETED: 'SITE_DELETED',
  ATTENDANCE_MARKED: 'ATTENDANCE_MARKED',
  ATTENDANCE_UPDATED: 'ATTENDANCE_UPDATED',
  PAYROLL_GENERATED: 'PAYROLL_GENERATED',
  PAYROLL_APPROVED: 'PAYROLL_APPROVED',
  PAYROLL_PAID: 'PAYROLL_PAID',
  ADVANCE_CREATED: 'ADVANCE_CREATED',
  ADVANCE_APPROVED: 'ADVANCE_APPROVED',
  ADVANCE_REJECTED: 'ADVANCE_REJECTED',
  ADVANCE_DEDUCTED: 'ADVANCE_DEDUCTED',
  ADVANCE_CARRIED_FORWARD: 'ADVANCE_CARRIED_FORWARD',
  LOAN_CREATED: 'LOAN_CREATED',
  LOAN_APPROVED: 'LOAN_APPROVED',
  USER_LOGIN: 'USER_LOGIN',
  USER_APPROVED: 'USER_APPROVED',
  USER_REJECTED: 'USER_REJECTED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
} as const;

export type AuditEvent = typeof AUDIT_EVENTS[keyof typeof AUDIT_EVENTS];
