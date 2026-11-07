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

// =====================================================
// TIMEZONE STRATEGY (single source of truth)
// =====================================================
// All business dates (attendance date, payroll week, advance date) are
// *calendar dates in Asia/Colombo*, stored as 'yyyy-MM-dd' strings.
//
// - A real instant (new Date(), Firestore Timestamp) is converted to its
//   Colombo calendar date with Intl (independent of the browser timezone).
// - A calendar date that must be represented as a Date object is anchored at
//   12:00 Colombo time, so it maps back to the same calendar day in every
//   timezone on Earth (UTC-12 … UTC+14).
// - Week arithmetic is done on calendar strings with UTC maths only.
export const BUSINESS_TIMEZONE = 'Asia/Colombo';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const colomboDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** True when the string is a plain calendar date (yyyy-MM-dd). */
export function isISODateString(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_RE.test(value);
}

/**
 * Represent a Colombo calendar date as a Date anchored at 12:00 Colombo time.
 */
export function fromISODateString(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00+05:30`);
}

/**
 * Convert any date representation to a Date whose *local* fields equal the
 * Colombo wall-clock time — used only for display formatting with date-fns.
 */
export function toSriLankanDate(date: Date | string | number): Date {
  const dateObj = isISODateString(date)
    ? fromISODateString(date)
    : typeof date === 'string'
      ? parseISO(date)
      : new Date(date);
  if (!isValid(dateObj)) return new Date(NaN);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
  }).formatToParts(dateObj);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

/**
 * Format a date using predefined formats (Colombo timezone safe)
 */
export function formatDate(
  date: Date | string | number,
  formatStr: keyof typeof DATE_FORMATS | string = 'DATE'
): string {
  const lkDate = toSriLankanDate(date);
  if (!isValid(lkDate)) return '—';
  const formatString = DATE_FORMATS[formatStr as keyof typeof DATE_FORMATS] || formatStr;
  return format(lkDate, formatString);
}

/**
 * Colombo calendar date (yyyy-MM-dd) of an instant. Calendar-date strings are
 * returned unchanged.
 */
export function toISODateString(date: Date | string | number): string {
  if (isISODateString(date)) return date;
  const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
  if (!isValid(dateObj)) return '';
  return colomboDateFormatter.format(dateObj); // en-CA → yyyy-MM-dd
}

/** Today's calendar date in Colombo. */
export function todayISO(): string {
  return toISODateString(new Date());
}

/** Add (or subtract) whole days to a calendar date string. */
export function addDaysISO(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Day of week of a calendar date: 0 = Sunday … 6 = Saturday. */
export function dayOfWeekISO(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Inclusive list of calendar dates from start to end. */
export function eachDateISO(startStr: string, endStr: string): string[] {
  const out: string[] = [];
  for (let d = startStr; d <= endStr; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

/**
 * The payroll week containing a date.
 * Week = Monday → Sunday. Monday–Saturday are normal working days; Sunday is
 * normally a holiday but emergency Sunday attendance (if any was actually
 * marked) belongs to the same week as the preceding Monday–Saturday.
 */
export function getPayrollWeek(date: Date | string = new Date()): { start: string; end: string } {
  const dateStr = toISODateString(date);
  const weekStartDay = PAYROLL_CONFIG.WEEK_START_DAY; // 1 = Monday
  const offset = (dayOfWeekISO(dateStr) - weekStartDay + 7) % 7;
  const start = addDaysISO(dateStr, -offset);
  return { start, end: addDaysISO(start, 6) };
}

/** Parse ISO date string (calendar dates are anchored at Colombo noon). */
export function parseDate(dateString: string): Date {
  return isISODateString(dateString) ? fromISODateString(dateString) : parseISO(dateString);
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
 * Check if date is today in Colombo
 */
export function isToday(date: Date | string): boolean {
  return toISODateString(date) === todayISO();
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
 * Start (Monday) of the payroll week, anchored at Colombo noon.
 */
export function getWeekStart(date: Date | string = new Date()): Date {
  return fromISODateString(getPayrollWeek(date).start);
}

/**
 * End (Sunday) of the payroll week, anchored at Colombo noon.
 * Compare calendar strings (toISODateString) rather than instants.
 */
export function getWeekEnd(date: Date | string = new Date()): Date {
  return fromISODateString(getPayrollWeek(date).end);
}

/**
 * Get all days in the payroll week (Colombo)
 */
export function getWeekDays(date: Date = new Date()): Date[] {
  const { start, end } = getPayrollWeek(date);
  return eachDateISO(start, end).map(fromISODateString);
}

/**
 * Get week number and year (Colombo)
 */
export function getWeekInfo(date: Date = new Date()): { week: number; year: number } {
  const lk = toSriLankanDate(getWeekStart(date));
  return {
    week: parseInt(format(lk, 'I')), // ISO week number (Monday-based)
    year: parseInt(format(lk, 'R')),
  };
}

/**
 * Format week range (e.g., "Dec 23 - Dec 29, 2024") in Colombo
 */
export function formatWeekRange(date: Date = new Date()): string {
  const start = toSriLankanDate(getWeekStart(date));
  const end = toSriLankanDate(getWeekEnd(date));
  
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, 'MMM d')} - ${format(end, 'd, yyyy')}`;
  }
  
  return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
}

/**
 * Get month range
 */
export function getMonthRange(date: Date = new Date()): { start: Date; end: Date } {
  const lkDate = toSriLankanDate(date);
  return {
    start: startOfMonth(lkDate),
    end: endOfMonth(lkDate),
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
  return formatDate(date, 'HH:mm');
}

/**
 * Format time with AM/PM
 */
export function formatTime12h(date: Date | string): string {
  return formatDate(date, 'hh:mm a');
}

/**
 * Get greeting based on time of day
 */
export function getGreeting(): string {
  const hour = toSriLankanDate(new Date()).getHours();
  
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
  return formatDate(date, 'dd/MM/yyyy HH:mm');
}
