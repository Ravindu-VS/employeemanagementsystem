import { describe, it, expect } from 'vitest';
import {
  toISODateString, getPayrollWeek, getWeekStart, getWeekEnd, formatDate, addDaysISO,
  dayOfWeekISO, eachDateISO, fromISODateString, getWeekNumber,
} from './date-utils';

// Run with different TZ values (see npm test:tz) — results must not change.
describe(`date-utils (process TZ=${process.env.TZ || 'default'})`, () => {
  it('converts instants to the Colombo calendar date', () => {
    // 2026-11-01 20:00 UTC = 2026-11-02 01:30 in Colombo
    expect(toISODateString(new Date('2026-11-01T20:00:00Z'))).toBe('2026-11-02');
    // 2026-11-02 18:00 UTC = 2026-11-02 23:30 in Colombo
    expect(toISODateString(new Date('2026-11-02T18:00:00Z'))).toBe('2026-11-02');
  });

  it('keeps calendar strings unchanged', () => {
    expect(toISODateString('2026-11-04')).toBe('2026-11-04');
    expect(formatDate('2026-11-04', 'DATE')).toBe('04/11/2026');
    expect(toISODateString(fromISODateString('2026-12-31'))).toBe('2026-12-31');
  });

  it('payroll week is Monday → Sunday', () => {
    expect(getPayrollWeek('2026-11-04')).toEqual({ start: '2026-11-02', end: '2026-11-08' });
    expect(getPayrollWeek('2026-11-02')).toEqual({ start: '2026-11-02', end: '2026-11-08' });
    // Sunday belongs to the week of the preceding Monday
    expect(getPayrollWeek('2026-11-08')).toEqual({ start: '2026-11-02', end: '2026-11-08' });
    expect(toISODateString(getWeekStart(new Date('2026-11-04T06:00:00Z')))).toBe('2026-11-02');
    expect(toISODateString(getWeekEnd(new Date('2026-11-04T06:00:00Z')))).toBe('2026-11-08');
  });

  it('handles month, year and leap-year boundaries', () => {
    expect(getPayrollWeek('2026-12-31')).toEqual({ start: '2026-12-28', end: '2027-01-03' });
    expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysISO('2027-02-28', 1)).toBe('2027-03-01');
    expect(getPayrollWeek('2028-03-01')).toEqual({ start: '2028-02-28', end: '2028-03-05' });
    expect(eachDateISO('2026-11-02', '2026-11-08')).toHaveLength(7);
  });

  it('day of week', () => {
    expect(dayOfWeekISO('2026-11-04')).toBe(3); // Wednesday
    expect(dayOfWeekISO('2026-11-08')).toBe(0); // Sunday
  });

  it('ISO week number', () => {
    expect(getWeekNumber(fromISODateString('2026-11-04'))).toBe(45);
  });
});
