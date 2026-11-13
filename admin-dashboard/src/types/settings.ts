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
  /** Supervisor pay per distinct site visited per day (LKR). Default 2000. */
  supervisorSiteVisitRate?: number;
  /** Distance-band transport allowance rules (rateType = 'distance_band'). */
  transportBands?: TransportBand[];
}

export interface TransportBand {
  minKm: number;        // inclusive
  maxKm: number | null; // exclusive; null = no upper bound
  ratePerDay: number;   // LKR per day worked
  label?: string;
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
  /** SMS through the notification service (needs NEXT_PUBLIC_NOTIFY_ENDPOINT). */
  smsEnabled?: boolean;
  inAppEnabled: boolean;
  payrollAlerts: boolean;
  advanceAlerts: boolean;
  loanAlerts: boolean;
  attendanceAlerts: boolean;
}

export type SettingsDocId = 'company' | 'payroll' | 'attendance' | 'notifications';
