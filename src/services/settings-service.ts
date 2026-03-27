/**
 * =====================================================
 * SETTINGS SERVICE
 * =====================================================
 * Firestore persistence for application settings.
 * Each settings category is a separate document in the 'settings' collection.
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { COLLECTIONS } from '@/constants';
import type {
  CompanySettings,
  PayrollSettings,
  AttendanceSettings,
  NotificationSettings,
  SettingsDocId,
} from '@/types';

// =====================================================
// DEFAULT VALUES
// =====================================================

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: 'Construction Company Ltd.',
  companyEmail: 'info@company.lk',
  companyPhone: '+94 11 234 5678',
  companyAddress: '123 Main Street, Colombo',
  companyWebsite: '',
  currency: 'LKR',
  timezone: 'Asia/Colombo',
};

export const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  cycle: 'weekly',
  payrollStartDay: 1, // Monday
  workingDaysPerWeek: 6,
  regularHoursPerDay: 8,
  otMultiplier: 1.5,
  holidayMultiplier: 2.0,
  maxAdvancePercent: 50,
  maxLoanEmis: 52,
  defaultInterestRate: 0,
  autoDeductAdvances: true,
  autoDeductLoans: true,
};

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  enableGeofence: true,
  defaultGeofenceRadius: 100,
  allowHalfDay: true,
  allowMultipleSessions: false,
  autoCloseAfterHours: 12,
  minSessionMinutes: 30,
  lockPastAttendanceAfterPayroll: false,
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  emailEnabled: true,
  inAppEnabled: true,
  payrollAlerts: true,
  advanceAlerts: true,
  loanAlerts: true,
  attendanceAlerts: true,
};

// =====================================================
// GENERIC GET / SAVE
// =====================================================

async function getSettingsDoc<T>(docId: SettingsDocId, defaults: T): Promise<T> {
  const docRef = doc(db, COLLECTIONS.SETTINGS, docId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    return { ...defaults };
  }

  const data = snap.data();
  // Merge with defaults so any newly-added fields are populated
  return { ...defaults, ...data } as T;
}

async function saveSettingsDoc<T extends Record<string, unknown>>(
  docId: SettingsDocId,
  data: T
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.SETTINGS, docId);
  await setDoc(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

// =====================================================
// COMPANY SETTINGS
// =====================================================

export async function getCompanySettings(): Promise<CompanySettings> {
  return getSettingsDoc<CompanySettings>('company', DEFAULT_COMPANY_SETTINGS);
}

export async function saveCompanySettings(data: CompanySettings): Promise<void> {
  return saveSettingsDoc('company', data as unknown as Record<string, unknown>);
}

// =====================================================
// PAYROLL SETTINGS
// =====================================================

export async function getPayrollSettings(): Promise<PayrollSettings> {
  return getSettingsDoc<PayrollSettings>('payroll', DEFAULT_PAYROLL_SETTINGS);
}

export async function savePayrollSettings(data: PayrollSettings): Promise<void> {
  return saveSettingsDoc('payroll', data as unknown as Record<string, unknown>);
}

// =====================================================
// ATTENDANCE SETTINGS
// =====================================================

export async function getAttendanceSettings(): Promise<AttendanceSettings> {
  return getSettingsDoc<AttendanceSettings>('attendance', DEFAULT_ATTENDANCE_SETTINGS);
}

export async function saveAttendanceSettings(data: AttendanceSettings): Promise<void> {
  return saveSettingsDoc('attendance', data as unknown as Record<string, unknown>);
}

// =====================================================
// NOTIFICATION SETTINGS
// =====================================================

export async function getNotificationSettings(): Promise<NotificationSettings> {
  return getSettingsDoc<NotificationSettings>('notifications', DEFAULT_NOTIFICATION_SETTINGS);
}

export async function saveNotificationSettings(data: NotificationSettings): Promise<void> {
  return saveSettingsDoc('notifications', data as unknown as Record<string, unknown>);
}

// =====================================================
// BULK LOAD (for settings page initialization)
// =====================================================

export interface AllSettings {
  company: CompanySettings;
  payroll: PayrollSettings;
  attendance: AttendanceSettings;
  notifications: NotificationSettings;
}

export async function getAllSettings(): Promise<AllSettings> {
  const [company, payroll, attendance, notifications] = await Promise.all([
    getCompanySettings(),
    getPayrollSettings(),
    getAttendanceSettings(),
    getNotificationSettings(),
  ]);
  return { company, payroll, attendance, notifications };
}
