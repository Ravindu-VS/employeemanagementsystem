/**
 * =====================================================
 * LEAVE TYPES
 * =====================================================
 */

export type LeaveType = 'annual' | 'sick' | 'casual' | 'unpaid';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  employeeId: string; // Firebase uid
  employeeName: string;
  type: LeaveType;
  startDate: string; // yyyy-MM-dd (Colombo)
  endDate: string;   // yyyy-MM-dd inclusive
  days: number;      // working days (Mon–Sat) in the range
  reason: string;
  status: LeaveStatus;
  requestedBy: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveSettings {
  annualDays: number;
  sickDays: number;
  casualDays: number;
}
