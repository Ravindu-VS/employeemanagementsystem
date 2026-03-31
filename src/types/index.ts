/**
 * =====================================================
 * CORE TYPE DEFINITIONS
 * =====================================================
 * Central type definitions for the Employee Management System.
 * All models, interfaces, and enums used across the application.
 */

// =====================================================
// USER & AUTHENTICATION TYPES
// =====================================================

/**
 * User roles in the system hierarchy
 * Order represents hierarchy level (owner > ceo > manager > supervisor > others)
 */
export type UserRole = 
  | 'owner'
  | 'ceo'
  | 'manager'
  | 'supervisor'
  | 'draughtsman'
  | 'bass'
  | 'helper';

/**
 * Authentication status
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * Base user interface from Firebase Auth + Firestore
 */
export interface User {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Extended user profile stored in Firestore
 */
export interface UserProfile extends User {
  workerId: string; // Format: WRK001, WRK002, etc.
  phone: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  dateOfBirth?: Date;
  joiningDate: Date;
  experience?: string;
  departmentId?: string;
  supervisorId?: string;
  assignedSites: string[];
  dailyRate: number;   // Per day payment (REQUIRED)
  otRate?: number;     // DEPRECATED: OT rate now derived as dailyRate / 8 at runtime
  hourlyRate?: number; // Legacy / calculated
  weeklyRate?: number; // Legacy / calculated
  bankDetails?: BankDetails;
  documents: UserDocument[];
  metadata: UserMetadata;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  ifscCode?: string;
  branchName?: string;
}

export interface UserDocument {
  id: string;
  type: 'id_proof' | 'address_proof' | 'photo' | 'contract' | 'other';
  name: string;
  url: string;
  uploadedAt: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
}

export interface UserMetadata {
  lastLoginAt?: Date;
  lastActiveAt?: Date;
  loginCount: number;
  deviceInfo?: string;
  appVersion?: string;
}

// =====================================================
// WORK SITE TYPES
// =====================================================

/**
 * Work site / construction site model
 */
export interface WorkSite {
  id: string;
  name: string;
  code: string; // Unique short code (e.g., "SITE-001")
  address: string;
  city: string;
  state: string;
  pincode: string;
  location: GeoPoint;
  geofenceRadius: number; // in meters
  isActive: boolean;
  supervisorIds: string[];
  managerId?: string;
  startDate: Date;
  expectedEndDate?: Date;
  actualEndDate?: Date;
  clientName?: string;
  clientContact?: string;
  projectType: string;
  status: SiteStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export type SiteStatus = 
  | 'planning'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'cancelled';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

// =====================================================
// ATTENDANCE TYPES
// =====================================================

/**
 * Daily attendance record for an employee
 * Contains multiple segments (start/end times at different sites)
 */
export interface DailyAttendance {
  id: string;
  date: string; // YYYY-MM-DD format
  employeeId: string;
  employeeName: string;
  segments: AttendanceSegment[];
  totalHours: number;
  totalOvertimeHours: number;
  status: AttendanceStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  syncedAt?: Date;
  isSynced: boolean;
}

/**
 * Single work segment within a day
 * Employee can have multiple segments (different sites, breaks, etc.)
 */
export interface AttendanceSegment {
  id: string;
  siteId: string;
  siteName: string;
  startTime: Date;
  endTime?: Date;
  startLocation: GeoPoint;
  endLocation?: GeoPoint;
  startPhotoUrl?: string;
  endPhotoUrl?: string;
  isValidLocation: boolean;
  markedBy: string; // supervisor or self
  markedByName: string;
  duration?: number; // in minutes
  breakDuration: number; // in minutes
  notes?: string;
  status: SegmentStatus;
}

export type AttendanceStatus = 
  | 'present'
  | 'absent'
  | 'half_day'
  | 'on_leave'
  | 'holiday'
  | 'week_off';

export type SegmentStatus = 
  | 'active'      // Currently working
  | 'completed'   // Segment ended properly
  | 'auto_closed' // System closed (forgot to clock out)
  | 'cancelled'   // Cancelled/void segment
  | 'pending_sync'; // Offline, pending sync

// =====================================================
// SIMPLIFIED ATTENDANCE (Supervisor Marking)
// =====================================================

/**
 * Simplified attendance record for supervisor marking.
 * Matches the construction-site paper sheet workflow:
 * - Morning shift (checkbox)
 * - Evening shift (checkbox)
 * - OT hours (number)
 * A worker can work TWO different sites in the same day.
 */
/**
 * Supervisor visit record for multi-site tracking
 */
export interface SimpleSupervisorVisit {
  siteId: string;
  visited: boolean;
  notes?: string;
  visitedAt: string; // ISO timestamp
}

export interface SimpleAttendance {
  id: string;
  date: string; // YYYY-MM-DD
  workerId: string;
  workerName: string;
  role?: string; // NEW: role to determine attendance structure

  // For LABOR WORKERS (bass, helper, draughtsman)
  morningSite?: string | null;  // siteId or null if absent
  eveningSite?: string | null;  // siteId or null if absent
  siteOtHours?: Record<string, number>; // Record of siteId to OT hours

  // For SUPERVISORS (owner, ceo, manager, supervisor)
  // use siteVisits array instead of morning/evening
  siteVisits?: SimpleSupervisorVisit[];

  otHours?: number;             // overtime hours
  supervisorId: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Bulk attendance marking payload for a site
 */
export interface BulkAttendanceEntry {
  workerId: string;
  workerName: string;
  morning: boolean;
  evening: boolean;
  otHours: number;
}

// =====================================================
// PAYROLL TYPES
// =====================================================

/**
 * Weekly payroll record
 */
export interface WeeklyPayroll {
  id: string;
  weekStartDate: string; // YYYY-MM-DD (Monday)
  weekEndDate: string;   // YYYY-MM-DD (Sunday)
  employeeId: string;
  employeeName: string;
  employeeRole: UserRole;
  
  // Hours
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  daysWorked: number;
  
  // Earnings
  regularEarnings: number;
  overtimeEarnings: number;
  bonuses: BonusEntry[];
  totalEarnings: number;
  
  // Per-site breakdown (added for multi-site support)
  siteBreakdowns?: SiteBreakdown[];
  
  // Deductions
  advances: AdvanceDeduction[];
  loanDeductions: LoanDeduction[];
  otherDeductions: OtherDeduction[];
  totalDeductions: number;
  
  // Final
  netPay: number;
  status: PayrollStatus;
  
  // Metadata
  generatedAt: Date;
  generatedBy: string;
  approvedAt?: Date;
  approvedBy?: string;
  paidAt?: Date;
  paymentMethod?: PaymentMethod;
  payslipUrl?: string;
  
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BonusEntry {
  id: string;
  type: string;
  description: string;
  amount: number;
  approvedBy: string;
  approvedAt: Date;
}

export interface AdvanceDeduction {
  advanceId: string;
  amount: number;
  description: string;
}

export interface LoanDeduction {
  loanId: string;
  emiAmount: number;
  emiNumber: number;
  totalEmis: number;
}

export interface OtherDeduction {
  id: string;
  type: string;
  description: string;
  amount: number;
}

export type PayrollStatus = 
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'paid'
  | 'cancelled';

export type PaymentMethod = 
  | 'cash'
  | 'bank_transfer'
  | 'cheque'
  | 'upi';

// =====================================================
// PER-SITE PAYROLL TYPES
// =====================================================

/**
 * Breakdown of one worker's attendance & pay at a single site
 */
export interface SiteBreakdown {
  siteId: string;
  siteName: string;
  daysWorked: number;   // 0.5 increments (morning/evening)
  otHours: number;
  regularPay: number;   // daysWorked × dailyRate
  otPay: number;        // otHours × otRate
  totalPay: number;     // regularPay + otPay
}

/**
 * Full payroll summary for one worker (across all sites)
 */
export interface WorkerPayrollSummary {
  workerId: string;
  workerName: string;
  workerRole: UserRole;
  dailyRate: number;
  otRate: number;        // DERIVED: dailyRate / 8 (not stored)
  siteBreakdowns: SiteBreakdown[];
  totalDays: number;
  totalOtHours: number;
  grossSalary: number;
  advances: AdvanceRequest[];   // un-deducted advances
  totalAdvanceDeduction: number;
  finalSalary: number;
}

/**
 * Aggregated payroll total for one site
 */
export interface SitePayrollTotal {
  siteId: string;
  siteName: string;
  totalPayroll: number;
  workerCount: number;
}

/**
 * Complete payroll report with workers, site totals, and grand total
 */
export interface PayrollReport {
  workers: WorkerPayrollSummary[];
  siteTotals: SitePayrollTotal[];
  grandTotal: number;
}

// =====================================================
// ADVANCE & LOAN TYPES
// =====================================================

export interface Advance {
  id: string;
  workerId: string;
  amount: number;
  date: string;
  reason: string;
  deducted: boolean;
  deductionWeek: string | null;
  createdBy?: string;
  createdAt?: Date;
}

export interface WorkerWeeklyPayroll {
  workerId: string;
  workerName: string;
  role: string;
  grossPay: number;
  pendingAdvances: Advance[];
  selectedAdvanceDeductions: Advance[];
  advanceDeductionTotal: number;
  loanDeduction: number;
  finalPay: number;
}

export interface FinalPayrollSummary {
  totalWorkers: number;
  totalDaysWorked: number;
  totalOtHours: number;
  totalBasePay: number;
  totalOtPay: number;
  totalGrossPay: number;
  totalAdvanceDeductions: number;
  totalLoanDeductions: number;
  finalPayrollTotal: number;
}

/**
 * Salary advance request
 *
 * Business Rules:
 * - status: "pending" (awaiting approval) → "approved" (eligible) → "rejected" (hidden)
 * - deducted: false (eligible for payroll) → true (already deducted, hidden from future weeks)
 * - deductionWeek: which week it was deducted (audit trail)
 */
export interface AdvanceRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  reason: string;
  requestedAt: Date;
  status: RequestStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  deducted: boolean;           // true = already deducted, hide from future weeks
  deductionWeek: string | null; // ISO date when deducted (e.g. "2026-03-23")
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Employee loan
 */
export interface Loan {
  id: string;
  employeeId: string;
  employeeName: string;
  principalAmount: number;
  interestRate: number; // percentage
  totalAmount: number;
  emiAmount: number;
  totalEmis: number;
  paidEmis: number;
  remainingAmount: number;
  reason: string;
  status: LoanStatus;
  approvedBy?: string;
  approvedAt?: Date;
  disbursedAt?: Date;
  completedAt?: Date;
  payments: LoanPayment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LoanPayment {
  id: string;
  emiNumber: number;
  amount: number;
  payrollId: string;
  paidAt: Date;
}

export type RequestStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type LoanStatus = 
  | 'pending'
  | 'approved'
  | 'active'
  | 'completed'
  | 'defaulted'
  | 'cancelled';

// =====================================================
// NOTIFICATION TYPES
// =====================================================

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  actionUrl?: string;
  data?: Record<string, unknown>;
  createdAt: Date;
  readAt?: Date;
}

export type NotificationType = 
  | 'attendance'
  | 'payroll'
  | 'advance'
  | 'loan'
  | 'announcement'
  | 'alert'
  | 'system';

// =====================================================
// AUDIT LOG TYPES
// =====================================================

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
  | 'export';

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}

// =====================================================
// FILTER & QUERY TYPES
// =====================================================

export interface DateRange {
  start: Date;
  end: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface EmployeeFilters {
  role?: UserRole;
  isActive?: boolean;
  siteId?: string;
  supervisorId?: string;
  searchQuery?: string;
}

export interface AttendanceFilters {
  employeeId?: string;
  siteId?: string;
  dateRange?: DateRange;
  status?: AttendanceStatus;
}

export interface PayrollFilters {
  employeeId?: string;
  weekStartDate?: string;
  status?: PayrollStatus;
}

// =====================================================
// DASHBOARD STATS TYPES
// =====================================================

export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  totalSites: number;
  activeSites: number;
  todayPresent: number;
  todayAbsent: number;
  pendingAdvances: number;
  pendingLoans: number;
  weeklyPayrollTotal: number;
  recentActivities: RecentActivity[];
}

export interface RecentActivity {
  id: string;
  type: string;
  description: string;
  userId: string;
  userName: string;
  timestamp: Date;
}

// =====================================================
// REPORT TYPES
// =====================================================

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

// =====================================================
// SETTINGS TYPES
// =====================================================

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
  LOAN_CREATED: 'LOAN_CREATED',
  LOAN_APPROVED: 'LOAN_APPROVED',
  USER_LOGIN: 'USER_LOGIN',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
} as const;

export type AuditEvent = typeof AUDIT_EVENTS[keyof typeof AUDIT_EVENTS];
