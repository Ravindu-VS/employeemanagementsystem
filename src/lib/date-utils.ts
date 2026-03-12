/**
 * =====================================================
 * DATE UTILITIES
 * =====================================================
 * Date formatting and manipulation helpers using date-fns.
 */

import {
  format,
  formatDistance,
  formatRelative,
  parseISO,
  isValid,
  isBefore,
  isAfter,
  isSameDay,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  getDay,
  setDay,
  eachDayOfInterval,
} from 'date-fns';
import { DATE_FORMATS, PAYROLL_CONFIG } from '@/constants';

/**
 * Format a date using predefined formats
 */
export function formatDate(
  date: Date | string | number,
  formatStr: keyof typeof DATE_FORMATS | string = 'DATE'
): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
  
  if (!isValid(dateObj)) {
    return 'Invalid date';
  }
  
  const formatString = DATE_FORMATS[formatStr as keyof typeof DATE_FORMATS] || formatStr;
  return format(dateObj, formatString);
}

/**
 * Format date as ISO string (YYYY-MM-DD)
 */
export function toISODateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Parse ISO date string to Date
 */
export function parseDate(dateString: string): Date {
  return parseISO(dateString);
}

/**
 * Get relative time (e.g., "5 minutes ago")
 */
export function getRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatDistance(dateObj, new Date(), { addSuffix: true });
}

/**
 * Get relative date (e.g., "yesterday at 2:30 PM")
 */
export function getRelativeDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatRelative(dateObj, new Date());
}

/**
 * Check if date is today
 */
export function isToday(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return isSameDay(dateObj, new Date());
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return isBefore(dateObj, new Date());
}

/**
 * Check if date is in the future
 */
export function isFuture(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return isAfter(dateObj, new Date());
}

/**
 * Get the start of the current week (Monday)
 */
export function getWeekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: PAYROLL_CONFIG.WEEK_START_DAY as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
}

/**
 * Get the end of the current week (Sunday)
 */
export function getWeekEnd(date: Date = new Date()): Date {
  return endOfWeek(date, { weekStartsOn: PAYROLL_CONFIG.WEEK_START_DAY as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
}

/**
 * Get all days in the current week
 */
export function getWeekDays(date: Date = new Date()): Date[] {
  const start = getWeekStart(date);
  const end = getWeekEnd(date);
  return eachDayOfInterval({ start, end });
}

/**
 * Get week number and year
 */
export function getWeekInfo(date: Date = new Date()): { week: number; year: number } {
  const weekStart = getWeekStart(date);
  return {
    week: parseInt(format(weekStart, 'w')),
    year: parseInt(format(weekStart, 'yyyy')),
  };
}

/**
 * Format week range (e.g., "Dec 23 - Dec 29, 2024")
 */
export function formatWeekRange(date: Date = new Date()): string {
  const start = getWeekStart(date);
  const end = getWeekEnd(date);
  
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, 'MMM d')} - ${format(end, 'd, yyyy')}`;
  }
  
  return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
}

/**
 * Get month range
 */
export function getMonthRange(date: Date = new Date()): { start: Date; end: Date } {
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
}

/**
 * Get day boundaries
 */
export function getDayRange(date: Date = new Date()): { start: Date; end: Date } {
  return {
    start: startOfDay(date),
    end: endOfDay(date),
  };
}

/**
 * Calculate duration between two dates in minutes
 */
export function getDurationInMinutes(start: Date, end: Date): number {
  return differenceInMinutes(end, start);
}

/**
 * Calculate duration between two dates in hours
 */
export function getDurationInHours(start: Date, end: Date): number {
  return differenceInHours(end, start);
}

/**
 * Calculate working days between two dates (excluding weekends)
 */
export function getWorkingDays(start: Date, end: Date): number {
  const days = eachDayOfInterval({ start, end });
  return days.filter((day) => {
    const dayOfWeek = getDay(day);
    return dayOfWeek !== 0 && dayOfWeek !== 6; // Exclude Sunday (0) and Saturday (6)
  }).length;
}

/**
 * Add time to date
 */
export const addTime = {
  days: addDays,
  weeks: addWeeks,
  months: addMonths,
};

/**
 * Subtract time from date
 */
export const subTime = {
  days: subDays,
  weeks: subWeeks,
  months: subMonths,
};

/**
 * Format time only (HH:mm)
 */
export function formatTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'HH:mm');
}

/**
 * Format time with AM/PM
 */
export function formatTime12h(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'hh:mm a');
}

/**
 * Get greeting based on time of day
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Get previous N weeks for payroll selection
 */
export function getPreviousWeeks(count: number = 8): Array<{ label: string; value: string }> {
  const weeks: Array<{ label: string; value: string }> = [];
  let currentDate = new Date();
  
  for (let i = 0; i < count; i++) {
    const weekStart = getWeekStart(currentDate);
    weeks.push({
      label: formatWeekRange(weekStart),
      value: toISODateString(weekStart),
    });
    currentDate = subWeeks(currentDate, 1);
  }
  
  return weeks;
}

// =====================================================
// RE-EXPORTS for convenience
// =====================================================
// Pages import these directly from date-utils instead of date-fns
export {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  differenceInDays,
  isSameDay,
  isBefore,
  isAfter,
  eachDayOfInterval,
  getDay,
  format as formatRaw,
};

/**
 * Get week number for a date
 */
export function getWeekNumber(date: Date = new Date()): number {
  return getWeekInfo(date).week;
}

/**
 * Format date and time together
 */
export function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(dateObj)) return 'Invalid date';
  return format(dateObj, 'dd/MM/yyyy HH:mm');
}
