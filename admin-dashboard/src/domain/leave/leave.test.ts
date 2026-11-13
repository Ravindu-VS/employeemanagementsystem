import { describe, it, expect } from 'vitest';
import { computeLeaveBalances, countLeaveDays, leaveOnDate, validateLeaveRequest } from './index';
import type { LeaveRequest } from '@/types';

const req = (p: Partial<LeaveRequest>): LeaveRequest => ({ id: 'l', employeeId: 'u1', employeeName: 'N', type: 'annual', startDate: '2026-11-02', endDate: '2026-11-02', days: 1, reason: '', status: 'approved', requestedBy: 'u1', createdAt: new Date(), updatedAt: new Date(), ...p });

describe('leave', () => {
  it('counts Monday–Saturday only', () => {
    expect(countLeaveDays('2026-11-02', '2026-11-08')).toBe(6); // Mon..Sun
    expect(countLeaveDays('2026-11-08', '2026-11-08')).toBe(0); // Sunday
    expect(countLeaveDays('2026-11-05', '2026-11-02')).toBe(0);
  });
  it('balance = entitlement − approved; pending shown separately', () => {
    const b = computeLeaveBalances([req({ days: 3 }), req({ id: 'p', days: 2, status: 'pending' }), req({ id: 'r', days: 5, status: 'rejected' }), req({ id: 'o', startDate: '2025-12-01', days: 4 })], '2026', { annualDays: 14, sickDays: 7, casualDays: 7 });
    expect(b.find((x) => x.type === 'annual')).toMatchObject({ used: 3, pending: 2, remaining: 11 });
  });
  it('rejects overlaps, empty ranges and over-balance requests', () => {
    const existing = [req({ startDate: '2026-11-03', endDate: '2026-11-04', days: 2 })];
    expect(validateLeaveRequest({ type: 'annual', startDate: '2026-11-04', endDate: '2026-11-05' }, existing)).toMatch(/Overlaps/);
    expect(validateLeaveRequest({ type: 'annual', startDate: '2026-11-08', endDate: '2026-11-08' }, [])).toMatch(/no working days/);
    expect(validateLeaveRequest({ type: 'sick', startDate: '2026-11-09', endDate: '2026-11-21' }, [], { annualDays: 14, sickDays: 7, casualDays: 7 })).toMatch(/Only 7 sick/);
    expect(validateLeaveRequest({ type: 'unpaid', startDate: '2026-11-09', endDate: '2026-11-30' }, [])).toBeNull();
    expect(validateLeaveRequest({ type: 'annual', startDate: '2026-11-09', endDate: '2026-11-10' }, existing)).toBeNull();
  });
  it('finds approved leave on a date', () => {
    expect(leaveOnDate([req({ startDate: '2026-11-02', endDate: '2026-11-04' })], 'u1', '2026-11-03')).toBeTruthy();
    expect(leaveOnDate([req({ status: 'pending' })], 'u1', '2026-11-02')).toBeUndefined();
  });
});
