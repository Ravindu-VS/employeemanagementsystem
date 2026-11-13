/**
 * =====================================================
 * ATTENDANCE TYPES
 * =====================================================
 */

import type { GeoPoint } from './site';
import type { UserRole } from './user';

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
 * Supervisor visit record for multi-site tracking
 */
export interface SimpleSupervisorVisit {
  siteId: string;
  visited: boolean;
  notes?: string;
  visitedAt: string; // ISO timestamp
}

/**
 * Simplified attendance record for supervisor marking.
 * Matches the construction-site paper sheet workflow:
 * - Morning shift (checkbox)
 * - Evening shift (checkbox)
 * - OT hours (number)
 * A worker can work TWO different sites in the same day.
 */
export interface SimpleAttendance {
  id: string;
  date: string; // YYYY-MM-DD
  workerId: string;
  workerName: string;


  // For LABOR WORKERS (bass, helper, draughtsman)
  morningSite?: string | null;  // siteId or null if absent
  eveningSite?: string | null;  // siteId or null if absent
  siteOtHours?: Record<string, number>; // Record of siteId to OT hours
  /** Current format: per-site morning/evening shifts (deterministic docs). */
  siteShifts?: Record<string, { morning: boolean; evening: boolean }>;

  // For SUPERVISORS (owner, ceo, manager, supervisor)
  // use siteVisits array instead of morning/evening
  siteVisits?: SimpleSupervisorVisit[];

  otHours?: number;             // overtime hours
  supervisorId: string;
  attendanceType: 'site' | 'driver';  // Type of attendance record
  role?: UserRole;             // Worker's role (for driver/supervisor logic)
  present?: boolean;           // For drivers: simple present/absent
  morningPresent?: boolean;    // For split shift drivers
  eveningPresent?: boolean;
  morningOtHours?: number;
  eveningOtHours?: number;
  remarks?: string;            // For drivers: additional remarks
  notes?: string;
  /**
   * Set (never deleted) when a legacy random-ID document has been folded into
   * its deterministic replacement. Superseded docs are ignored by every reader.
   */
  superseded?: boolean;
  supersededBy?: string;
  createdBy?: string;
  updatedBy?: string;
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
  role?: UserRole;
}
