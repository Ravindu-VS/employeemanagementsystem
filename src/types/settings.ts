/**
 * =====================================================
 * SETTINGS TYPES
 * =====================================================
 */

export interface CompanySettings {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  companyWebsite: string;
  currency: string;
  timezone: string;
}

export interface PayrollSettings {
  cycle: 'weekly' | 'biweekly' | 'monthly';
  payrollStartDay: number; // 0=Sunday, 1=Monday, etc.
  workingDaysPerWeek: number;
  regularHoursPerDay: number;
  otMultiplier: number;
  holidayMultiplier: number;
  maxAdvancePercent: number;
  maxLoanEmis: number;
  defaultInterestRate: number;
  autoDeductAdvances: boolean;
  autoDeductLoans: boolean;
}

export interface AttendanceSettings {
  enableGeofence: boolean;
  defaultGeofenceRadius: number;
  allowHalfDay: boolean;
  allowMultipleSessions: boolean;
  autoCloseAfterHours: number;
  minSessionMinutes: number;
  lockPastAttendanceAfterPayroll: boolean;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  payrollAlerts: boolean;
  advanceAlerts: boolean;
  loanAlerts: boolean;
  attendanceAlerts: boolean;
}

export type SettingsDocId = 'company' | 'payroll' | 'attendance' | 'notifications';
