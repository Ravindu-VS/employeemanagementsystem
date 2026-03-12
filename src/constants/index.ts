/**
 * =====================================================
 * APPLICATION CONSTANTS
 * =====================================================
 * Centralized constants to avoid hardcoded values throughout the app.
 */

// =====================================================
// APPLICATION INFO
// =====================================================

export const APP_CONFIG = {
  name: 'Employee Management System',
  shortName: 'EMS',
  version: '1.0.0',
  description: 'Complete workforce management solution',
  company: 'Your Company Name',
  supportEmail: 'support@company.com',
  supportPhone: '+94 11 234 5678',
} as const;

// =====================================================
// ROUTES
// =====================================================

export const ROUTES = {
  // Public routes
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  
  // Dashboard routes
  DASHBOARD: '/dashboard',
  
  // Employee routes - nested object structure for better organization
  EMPLOYEES: {
    LIST: '/dashboard/employees',
    CREATE: '/dashboard/employees/create',
    DETAIL: (id: string) => `/dashboard/employees/${id}`,
    EDIT: (id: string) => `/dashboard/employees/${id}/edit`,
  },
  
  // Site routes
  SITES: {
    LIST: '/dashboard/sites',
    CREATE: '/dashboard/sites/create',
    DETAIL: (id: string) => `/dashboard/sites/${id}`,
    EDIT: (id: string) => `/dashboard/sites/${id}/edit`,
  },
  
  // Attendance routes
  ATTENDANCE: {
    LIST: '/dashboard/attendance',
    DAILY: '/dashboard/attendance/daily',
    HISTORY: '/dashboard/attendance/history',
    REPORTS: '/dashboard/attendance/reports',
  },
  
  // Payroll routes
  PAYROLL: {
    LIST: '/dashboard/payroll',
    WEEKLY: '/dashboard/payroll/weekly',
    GENERATE: '/dashboard/payroll/generate',
    HISTORY: '/dashboard/payroll/history',
    PAYSLIP: (id: string) => `/dashboard/payroll/payslip/${id}`,
  },
  
  // Finance routes
  ADVANCES: {
    LIST: '/dashboard/advances',
  },
  LOANS: {
    LIST: '/dashboard/loans',
    DETAIL: (id: string) => `/dashboard/loans/${id}`,
  },
  
  // Reports routes
  REPORTS: {
    LIST: '/dashboard/reports',
    ATTENDANCE: '/dashboard/reports/attendance',
    PAYROLL: '/dashboard/reports/payroll',
    SITES: '/dashboard/reports/sites',
  },
  
  // Settings routes
  SETTINGS: {
    LIST: '/dashboard/settings',
    PROFILE: '/dashboard/settings/profile',
    COMPANY: '/dashboard/settings/company',
    NOTIFICATIONS: '/dashboard/settings/notifications',
  },
  
  // Audit routes
  AUDIT_LOGS: '/dashboard/audit-logs',
} as const;

// =====================================================
// FIREBASE COLLECTIONS
// =====================================================

export const COLLECTIONS = {
  USERS: 'users',
  SITES: 'sites',
  ATTENDANCE: 'attendance',
  PAYROLL: 'payroll',
  ADVANCES: 'advances',
  LOANS: 'loans',
  NOTIFICATIONS: 'notifications',
  AUDIT_LOGS: 'auditLogs',
  SETTINGS: 'settings',
} as const;

// =====================================================
// USER ROLES CONFIGURATION
// =====================================================

export const USER_ROLES = {
  owner: {
    label: 'Owner',
    level: 1,
    color: 'purple',
    permissions: ['all'],
  },
  ceo: {
    label: 'CEO',
    level: 2,
    color: 'indigo',
    permissions: ['all'],
  },
  manager: {
    label: 'Manager',
    level: 3,
    color: 'blue',
    permissions: ['manage_employees', 'manage_attendance', 'manage_payroll', 'view_reports'],
  },
  supervisor: {
    label: 'Supervisor',
    level: 4,
    color: 'green',
    permissions: ['mark_attendance', 'view_team', 'view_own_payslip'],
  },
  draughtsman: {
    label: 'Draughtsman',
    level: 5,
    color: 'yellow',
    permissions: ['view_own_attendance', 'view_own_payslip', 'request_advance'],
  },
  bass: {
    label: 'Bass (Skilled Worker)',
    level: 5,
    color: 'orange',
    permissions: ['view_own_attendance', 'view_own_payslip', 'request_advance'],
  },
  helper: {
    label: 'Helper',
    level: 6,
    color: 'gray',
    permissions: ['view_own_attendance', 'view_own_payslip', 'request_advance'],
  },
} as const;

// Role options for dropdowns/selects
export const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'ceo', label: 'CEO' },
  { value: 'manager', label: 'Manager' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'draughtsman', label: 'Draughtsman' },
  { value: 'bass', label: 'Bass (Skilled Worker)' },
  { value: 'helper', label: 'Helper' },
] as const;

// =====================================================
// ATTENDANCE CONFIGURATION
// =====================================================

export const ATTENDANCE_CONFIG = {
  // Work hours configuration
  STANDARD_WORK_HOURS: 8,
  MAX_OVERTIME_HOURS: 4,
  
  // Break configuration
  DEFAULT_BREAK_DURATION: 60, // minutes
  
  // Geofence
  DEFAULT_GEOFENCE_RADIUS: 100, // meters
  MAX_GEOFENCE_RADIUS: 500, // meters
  
  // Auto-close
  AUTO_CLOSE_AFTER_HOURS: 12, // hours
  
  // Late thresholds
  LATE_THRESHOLD_MINUTES: 15,
  HALF_DAY_THRESHOLD_HOURS: 4,
} as const;

// =====================================================
// PAYROLL CONFIGURATION
// =====================================================

export const PAYROLL_CONFIG = {
  // Week configuration
  WEEK_START_DAY: 1, // Monday = 1, Sunday = 0
  
  // Overtime rates
  OVERTIME_MULTIPLIER: 1.5,
  HOLIDAY_MULTIPLIER: 2.0,
  
  // Default rates (can be overridden per employee)
  DEFAULT_HOURLY_RATE: 100,
  
  // Advance limits
  MAX_ADVANCE_PERCENTAGE: 50, // of weekly salary
  
  // Loan configuration
  MAX_LOAN_EMIS: 52, // 1 year weekly
  MAX_LOAN_AMOUNT_MULTIPLIER: 4, // 4x monthly salary
  DEFAULT_INTEREST_RATE: 0, // percentage
} as const;

// =====================================================
// SITE STATUS OPTIONS
// =====================================================

export const SITE_STATUSES = [
  { value: 'planning', label: 'Planning', color: 'gray' },
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'on_hold', label: 'On Hold', color: 'yellow' },
  { value: 'completed', label: 'Completed', color: 'blue' },
  { value: 'cancelled', label: 'Cancelled', color: 'red' },
] as const;

// =====================================================
// PAGINATION DEFAULTS
// =====================================================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  LIMITS: [10, 25, 50, 100],
  MAX_LIMIT: 100,
} as const;

// =====================================================
// DATE/TIME FORMATS
// =====================================================

export const DATE_FORMATS = {
  DATE: 'dd/MM/yyyy',
  DATE_SHORT: 'dd MMM',
  DATE_LONG: 'dd MMMM yyyy',
  TIME: 'HH:mm',
  TIME_12H: 'hh:mm a',
  DATETIME: 'dd/MM/yyyy HH:mm',
  DATETIME_12H: 'dd/MM/yyyy hh:mm a',
  ISO_DATE: 'yyyy-MM-dd',
  MONTH_YEAR: 'MMMM yyyy',
  WEEK: "'Week' w, yyyy",
} as const;

// =====================================================
// VALIDATION MESSAGES
// =====================================================

export const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  EMAIL_INVALID: 'Please enter a valid email address',
  PHONE_INVALID: 'Please enter a valid phone number',
  PASSWORD_MIN: 'Password must be at least 8 characters',
  PASSWORD_WEAK: 'Password must contain uppercase, lowercase, number and special character',
  AMOUNT_POSITIVE: 'Amount must be greater than 0',
  DATE_INVALID: 'Please enter a valid date',
  DATE_FUTURE: 'Date cannot be in the future',
  DATE_PAST: 'Date cannot be in the past',
} as const;

// =====================================================
// API ERROR CODES
// =====================================================

export const ERROR_CODES = {
  // Authentication
  AUTH_INVALID_CREDENTIALS: 'auth/invalid-credentials',
  AUTH_USER_NOT_FOUND: 'auth/user-not-found',
  AUTH_WRONG_PASSWORD: 'auth/wrong-password',
  AUTH_EMAIL_EXISTS: 'auth/email-already-in-use',
  AUTH_WEAK_PASSWORD: 'auth/weak-password',
  AUTH_SESSION_EXPIRED: 'auth/session-expired',
  AUTH_UNAUTHORIZED: 'auth/unauthorized',
  
  // Database
  DB_NOT_FOUND: 'db/not-found',
  DB_PERMISSION_DENIED: 'db/permission-denied',
  DB_CONFLICT: 'db/conflict',
  
  // Validation
  VALIDATION_FAILED: 'validation/failed',
  
  // General
  NETWORK_ERROR: 'network/error',
  UNKNOWN_ERROR: 'unknown/error',
} as const;

// =====================================================
// TOAST MESSAGES
// =====================================================

export const TOAST_MESSAGES = {
  // Success messages
  SAVE_SUCCESS: 'Changes saved successfully',
  CREATE_SUCCESS: 'Created successfully',
  UPDATE_SUCCESS: 'Updated successfully',
  DELETE_SUCCESS: 'Deleted successfully',
  LOGIN_SUCCESS: 'Welcome back!',
  LOGOUT_SUCCESS: 'Logged out successfully',
  
  // Error messages
  SAVE_ERROR: 'Failed to save changes',
  LOAD_ERROR: 'Failed to load data',
  DELETE_ERROR: 'Failed to delete',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  PERMISSION_ERROR: 'You do not have permission for this action',
  
  // Loading messages
  LOADING: 'Loading...',
  SAVING: 'Saving...',
  PROCESSING: 'Processing...',
} as const;

// =====================================================
// LOCAL STORAGE KEYS
// =====================================================

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'ems_auth_token',
  USER_DATA: 'ems_user_data',
  THEME: 'ems_theme',
  SIDEBAR_COLLAPSED: 'ems_sidebar_collapsed',
  TABLE_PAGE_SIZE: 'ems_table_page_size',
  LAST_SYNC: 'ems_last_sync',
} as const;
