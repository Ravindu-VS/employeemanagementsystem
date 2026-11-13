/**
 * =====================================================
 * FILTER & QUERY TYPES
 * =====================================================
 */

import type { UserRole } from './user';
import type { AttendanceStatus } from './attendance';
import type { PayrollStatus } from './payroll';

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
