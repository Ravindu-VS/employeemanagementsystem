/**
 * =====================================================
 * ATTENDANCE SERVICE
 * =====================================================
 * Data operations for attendance management.
 */

import {
  getDocument,
  getDocuments,
  getPaginatedDocuments,
  createDocument,
  updateDocument,
  query,
  where,
  orderBy,
  generateDocId,
} from '@/lib/firebase/firestore';
import { uploadAttendancePhoto } from '@/lib/firebase/storage';
import { COLLECTIONS, ATTENDANCE_CONFIG } from '@/constants';
import { toISODateString, getDurationInMinutes } from '@/lib/date-utils';
import type { 
  DailyAttendance, 
  AttendanceSegment, 
  AttendanceStatus,
  SegmentStatus,
  GeoPoint,
  SimpleAttendance,
  BulkAttendanceEntry,
  PaginatedResponse, 
  PaginationParams,
  AttendanceFilters,
  DateRange,
} from '@/types';

/**
 * Get attendance record by ID
 */
export async function getAttendance(attendanceId: string): Promise<DailyAttendance | null> {
  return getDocument<DailyAttendance>(COLLECTIONS.ATTENDANCE, attendanceId);
}

/**
 * Get attendance for a specific employee on a specific date
 */
export async function getEmployeeAttendanceByDate(
  employeeId: string,
  date: Date | string
): Promise<DailyAttendance | null> {
  const dateStr = typeof date === 'string' ? date : toISODateString(date);
  
  const records = await getDocuments<DailyAttendance>(COLLECTIONS.ATTENDANCE, [
    where('employeeId', '==', employeeId),
    where('date', '==', dateStr),
  ]);
  
  return records.length > 0 ? records[0] : null;
}

/**
 * Get attendance records for a date range
 */
export async function getAttendanceByDateRange(
  dateRange: DateRange,
  employeeId?: string
): Promise<DailyAttendance[]> {
  const startDate = toISODateString(dateRange.start);
  const endDate = toISODateString(dateRange.end);
  
  const constraints = [
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc'),
  ];
  
  if (employeeId) {
    constraints.unshift(where('employeeId', '==', employeeId));
  }
  
  return getDocuments<DailyAttendance>(COLLECTIONS.ATTENDANCE, constraints);
}

/**
 * Get today's attendance for all employees
 */
export async function getTodayAttendance(): Promise<DailyAttendance[]> {
  const today = toISODateString(new Date());
  
  return getDocuments<DailyAttendance>(COLLECTIONS.ATTENDANCE, [
    where('date', '==', today),
    orderBy('employeeName', 'asc'),
  ]);
}

/**
 * Get attendance with pagination
 */
export async function getAttendancePaginated(
  params: PaginationParams,
  filters?: AttendanceFilters
): Promise<PaginatedResponse<DailyAttendance>> {
  const constraints = [];

  if (filters?.employeeId) {
    constraints.push(where('employeeId', '==', filters.employeeId));
  }
  
  if (filters?.dateRange) {
    constraints.push(where('date', '>=', toISODateString(filters.dateRange.start)));
    constraints.push(where('date', '<=', toISODateString(filters.dateRange.end)));
  }
  
  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  return getPaginatedDocuments<DailyAttendance>(
    COLLECTIONS.ATTENDANCE,
    params,
    constraints
  );
}

/**
 * Create or get attendance record for an employee on a date
 */
export async function getOrCreateAttendance(
  employeeId: string,
  employeeName: string,
  date: Date = new Date()
): Promise<DailyAttendance> {
  const dateStr = toISODateString(date);
  
  // Check if record exists
  let attendance = await getEmployeeAttendanceByDate(employeeId, dateStr);
  
  if (!attendance) {
    // Create new attendance record
    const newAttendance: Omit<DailyAttendance, 'id' | 'createdAt' | 'updatedAt'> = {
      date: dateStr,
      employeeId,
      employeeName,
      segments: [],
      totalHours: 0,
      totalOvertimeHours: 0,
      status: 'absent',
      isSynced: true,
    };
    
    const id = await createDocument<DailyAttendance>(COLLECTIONS.ATTENDANCE, newAttendance as any);
    
    attendance = {
      id,
      ...newAttendance,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  
  return attendance;
}

/**
 * Start a new attendance segment
 */
export async function startAttendanceSegment(
  attendanceId: string,
  segmentData: {
    siteId: string;
    siteName: string;
    location: GeoPoint;
    markedBy: string;
    markedByName: string;
    photoFile?: File | Blob;
    notes?: string;
  }
): Promise<AttendanceSegment> {
  // Get current attendance
  const attendance = await getAttendance(attendanceId);
  
  if (!attendance) {
    throw new Error('Attendance record not found');
  }
  
  // Check for active segments
  const activeSegment = attendance.segments.find(s => s.status === 'active');
  
  if (activeSegment) {
    throw new Error('There is already an active segment. Please end it first.');
  }
  
  // Generate segment ID
  const segmentId = generateDocId(COLLECTIONS.ATTENDANCE);
  
  // Upload photo if provided
  let startPhotoUrl: string | undefined;
  if (segmentData.photoFile) {
    startPhotoUrl = await uploadAttendancePhoto(
      segmentData.photoFile,
      attendance.employeeId,
      segmentId,
      'start'
    );
  }
  
  // Create new segment
  const newSegment: AttendanceSegment = {
    id: segmentId,
    siteId: segmentData.siteId,
    siteName: segmentData.siteName,
    startTime: new Date(),
    startLocation: segmentData.location,
    startPhotoUrl,
    isValidLocation: true, // TODO: Validate against geofence
    markedBy: segmentData.markedBy,
    markedByName: segmentData.markedByName,
    breakDuration: 0,
    notes: segmentData.notes,
    status: 'active',
  };
  
  // Update attendance record
  const segments = [...attendance.segments, newSegment];
  
  await updateDocument<DailyAttendance>(COLLECTIONS.ATTENDANCE, attendanceId, {
    segments,
    status: 'present',
  });
  
  return newSegment;
}

/**
 * End an attendance segment
 */
export async function endAttendanceSegment(
  attendanceId: string,
  segmentId: string,
  endData: {
    location: GeoPoint;
    photoFile?: File | Blob;
    breakDuration?: number;
    notes?: string;
  }
): Promise<AttendanceSegment> {
  // Get current attendance
  const attendance = await getAttendance(attendanceId);
  
  if (!attendance) {
    throw new Error('Attendance record not found');
  }
  
  // Find the segment
  const segmentIndex = attendance.segments.findIndex(s => s.id === segmentId);
  
  if (segmentIndex === -1) {
    throw new Error('Segment not found');
  }
  
  const segment = attendance.segments[segmentIndex];
  
  if (segment.status !== 'active') {
    throw new Error('Segment is not active');
  }
  
  // Upload photo if provided
  let endPhotoUrl: string | undefined;
  if (endData.photoFile) {
    endPhotoUrl = await uploadAttendancePhoto(
      endData.photoFile,
      attendance.employeeId,
      segmentId,
      'end'
    );
  }
  
  // Calculate duration
  const endTime = new Date();
  const duration = getDurationInMinutes(segment.startTime, endTime);
  const breakDuration = endData.breakDuration || 0;
  const workDuration = duration - breakDuration;
  
  // Update segment
  const updatedSegment: AttendanceSegment = {
    ...segment,
    endTime,
    endLocation: endData.location,
    endPhotoUrl,
    duration: workDuration,
    breakDuration,
    notes: endData.notes || segment.notes,
    status: 'completed',
  };
  
  // Update segments array
  const segments = [...attendance.segments];
  segments[segmentIndex] = updatedSegment;
  
  // Calculate total hours
  const { totalHours, overtimeHours, status } = calculateAttendanceTotals(segments);
  
  await updateDocument<DailyAttendance>(COLLECTIONS.ATTENDANCE, attendanceId, {
    segments,
    totalHours,
    totalOvertimeHours: overtimeHours,
    status,
  });
  
  return updatedSegment;
}

/**
 * Calculate attendance totals from segments
 */
function calculateAttendanceTotals(segments: AttendanceSegment[]): {
  totalHours: number;
  overtimeHours: number;
  status: AttendanceStatus;
} {
  const completedSegments = segments.filter(s => s.status === 'completed' || s.status === 'auto_closed');
  
  const totalMinutes = completedSegments.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalHours = totalMinutes / 60;
  
  const standardHours = ATTENDANCE_CONFIG.STANDARD_WORK_HOURS;
  const overtimeHours = Math.max(0, totalHours - standardHours);
  
  // Determine status
  let status: AttendanceStatus = 'absent';
  
  if (totalHours >= standardHours) {
    status = 'present';
  } else if (totalHours >= ATTENDANCE_CONFIG.HALF_DAY_THRESHOLD_HOURS) {
    status = 'half_day';
  } else if (totalHours > 0) {
    status = 'present'; // Partial attendance
  }
  
  return {
    totalHours: Math.round(totalHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    status,
  };
}

/**
 * Mark attendance as absent
 */
export async function markAbsent(
  employeeId: string,
  employeeName: string,
  date: Date = new Date(),
  reason?: string
): Promise<void> {
  const attendance = await getOrCreateAttendance(employeeId, employeeName, date);
  
  await updateDocument<DailyAttendance>(COLLECTIONS.ATTENDANCE, attendance.id, {
    status: 'absent',
    notes: reason,
    segments: [],
    totalHours: 0,
    totalOvertimeHours: 0,
  });
}

/**
 * Mark attendance as on leave
 */
export async function markOnLeave(
  employeeId: string,
  employeeName: string,
  date: Date = new Date(),
  leaveType?: string
): Promise<void> {
  const attendance = await getOrCreateAttendance(employeeId, employeeName, date);
  
  await updateDocument<DailyAttendance>(COLLECTIONS.ATTENDANCE, attendance.id, {
    status: 'on_leave',
    notes: leaveType,
    segments: [],
    totalHours: 0,
    totalOvertimeHours: 0,
  });
}

/**
 * Get attendance summary for an employee
 */
export async function getEmployeeAttendanceSummary(
  employeeId: string,
  dateRange: DateRange
): Promise<{
  totalDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  leaveDays: number;
  totalHours: number;
  overtimeHours: number;
}> {
  const records = await getAttendanceByDateRange(dateRange, employeeId);
  
  return {
    totalDays: records.length,
    presentDays: records.filter(r => r.status === 'present').length,
    absentDays: records.filter(r => r.status === 'absent').length,
    halfDays: records.filter(r => r.status === 'half_day').length,
    leaveDays: records.filter(r => r.status === 'on_leave').length,
    totalHours: records.reduce((sum, r) => sum + r.totalHours, 0),
    overtimeHours: records.reduce((sum, r) => sum + r.totalOvertimeHours, 0),
  };
}

/**
 * Auto-close orphaned active segments
 * Should be run periodically (e.g., end of day)
 */
export async function autoCloseOrphanedSegments(): Promise<number> {
  const today = toISODateString(new Date());
  
  // Get today's attendance records with active segments
  const records = await getDocuments<DailyAttendance>(COLLECTIONS.ATTENDANCE, [
    where('date', '==', today),
  ]);
  
  let closedCount = 0;
  
  for (const record of records) {
    const activeSegments = record.segments.filter(s => s.status === 'active');
    
    if (activeSegments.length > 0) {
      const now = new Date();
      
      const updatedSegments = record.segments.map(segment => {
        if (segment.status === 'active') {
          // Check if segment has been active too long
          const duration = getDurationInMinutes(segment.startTime, now);
          
          if (duration > ATTENDANCE_CONFIG.AUTO_CLOSE_AFTER_HOURS * 60) {
            closedCount++;
            return {
              ...segment,
              endTime: now,
              duration,
              status: 'auto_closed' as SegmentStatus,
              notes: (segment.notes || '') + ' [Auto-closed by system]',
            };
          }
        }
        return segment;
      });
      
      if (closedCount > 0) {
        const { totalHours, overtimeHours, status } = calculateAttendanceTotals(updatedSegments);
        
        await updateDocument<DailyAttendance>(COLLECTIONS.ATTENDANCE, record.id, {
          segments: updatedSegments,
          totalHours,
          totalOvertimeHours: overtimeHours,
          status,
        });
      }
    }
  }
  
  return closedCount;
}

// =====================================================
// SIMPLIFIED ATTENDANCE (Supervisor Marking)
// =====================================================
// Matches the construction-site paper sheet workflow.

const SIMPLE_ATTENDANCE_COLLECTION = 'simpleAttendance';

/**
 * Get simple attendance records for a date and optional site
 */
export async function getSimpleAttendance(
  date: string,
  siteId?: string
): Promise<SimpleAttendance[]> {
  const constraints = [where('date', '==', date)];

  const records = await getDocuments<SimpleAttendance>(SIMPLE_ATTENDANCE_COLLECTION, constraints);

  if (siteId) {
    return records.filter(r => r.morningSite === siteId || r.eveningSite === siteId);
  }

  return records;
}

/**
 * Get simple attendance for a specific worker on a date
 */
export async function getWorkerSimpleAttendance(
  workerId: string,
  date: string
): Promise<SimpleAttendance | null> {
  const records = await getDocuments<SimpleAttendance>(SIMPLE_ATTENDANCE_COLLECTION, [
    where('workerId', '==', workerId),
    where('date', '==', date),
  ]);
  return records.length > 0 ? records[0] : null;
}

/**
 * Mark simple attendance for a single worker
 */
export async function markSimpleAttendance(
  data: {
    date: string;
    workerId: string;
    workerName: string;
    morningSite: string | null;
    eveningSite: string | null;
    otHours: number;
    supervisorId: string;
    notes?: string;
  }
): Promise<string> {
  const existing = await getWorkerSimpleAttendance(data.workerId, data.date);

  if (existing) {
    await updateDocument<SimpleAttendance>(SIMPLE_ATTENDANCE_COLLECTION, existing.id, {
      morningSite: data.morningSite,
      eveningSite: data.eveningSite,
      otHours: data.otHours,
      supervisorId: data.supervisorId,
      notes: data.notes,
    });
    return existing.id;
  }

  return createDocument<SimpleAttendance>(SIMPLE_ATTENDANCE_COLLECTION, {
    date: data.date,
    workerId: data.workerId,
    workerName: data.workerName,
    morningSite: data.morningSite,
    eveningSite: data.eveningSite,
    otHours: data.otHours,
    supervisorId: data.supervisorId,
    notes: data.notes,
  } as any);
}

/**
 * Bulk mark attendance for multiple workers (supervisor workflow).
 * Designed for <5 seconds per worker interaction.
 */
export async function bulkMarkSimpleAttendance(
  date: string,
  siteId: string,
  entries: BulkAttendanceEntry[],
  supervisorId: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      const existing = await getWorkerSimpleAttendance(entry.workerId, date);

      const morningSite = entry.morning ? siteId : (existing?.morningSite ?? null);
      const eveningSite = entry.evening ? siteId : (existing?.eveningSite ?? null);
      const otHours = entry.otHours + (existing?.otHours ?? 0);

      await markSimpleAttendance({
        date,
        workerId: entry.workerId,
        workerName: entry.workerName,
        morningSite,
        eveningSite,
        otHours,
        supervisorId,
      });
      success++;
    } catch {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Get attendance summary for a worker over a date range (for payroll).
 * Returns days worked (morning+evening = 1 full day, one shift = 0.5).
 */
export async function getWorkerWeeklyAttendanceSummary(
  workerId: string,
  startDate: string,
  endDate: string
): Promise<{ daysWorked: number; otHours: number }> {
  const records = await getDocuments<SimpleAttendance>(SIMPLE_ATTENDANCE_COLLECTION, [
    where('workerId', '==', workerId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
  ]);

  let daysWorked = 0;
  let otHours = 0;

  for (const record of records) {
    const hasMorning = record.morningSite !== null;
    const hasEvening = record.eveningSite !== null;

    if (hasMorning && hasEvening) {
      daysWorked += 1;
    } else if (hasMorning || hasEvening) {
      daysWorked += 0.5;
    }

    otHours += record.otHours || 0;
  }

  return { daysWorked, otHours };
}

/**
 * Get daily attendance for today's display (all workers)
 */
export async function getDailySimpleAttendance(date: string): Promise<SimpleAttendance[]> {
  return getDocuments<SimpleAttendance>(SIMPLE_ATTENDANCE_COLLECTION, [
    where('date', '==', date),
  ]);
}
