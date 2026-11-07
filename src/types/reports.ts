/**
 * =====================================================
 * REPORT TYPES
 * =====================================================
 */

import type { UserRole } from './user';

export interface AttendanceReport {
  employeeId: string;
  employeeName: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  leaveDays: number;
  totalHours: number;
  overtimeHours: number;
  averageHoursPerDay: number;
}

export interface PayrollSummaryReport {
  weekStartDate: string;
  weekEndDate: string;
  totalEmployees: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalEarnings: number;
  totalDeductions: number;
  totalNetPay: number;
  byRole: {
    role: UserRole;
    count: number;
    totalPay: number;
  }[];
}

export interface SiteReport {
  siteId: string;
  siteName: string;
  totalEmployees: number;
  totalHours: number;
  totalPayroll: number;
  averageAttendance: number;
}
