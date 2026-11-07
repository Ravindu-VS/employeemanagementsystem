import { describe, it, expect } from 'vitest';
import { detectAnomalies } from './index';
import { computePayroll } from '@/domain/payroll';
import type { SimpleAttendance, UserProfile } from '@/types';

const week = { start: '2026-11-02', end: '2026-11-08' };
const emp = (p: Partial<UserProfile>) => ({ uid: 'u', workerId: 'U', displayName: 'Nimal', role: 'helper', dailyRate: 8000, isActive: true, ...p }) as UserProfile;
const day = (date: string, ot: number) => ({ id: date, workerId: 'U', workerName: 'Nimal', date, attendanceType: 'site', siteShifts: { A: { morning: true, evening: true } }, siteOtHours: { A: ot } }) as unknown as SimpleAttendance;

describe('anomaly detection (flags only)', () => {
  it('flags excessive OT and large deductions, without changing pay', () => {
    const r = computePayroll({ period: week, sites: [{ id: 'A', name: 'A' }], employees: [emp({})], attendance: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'].map((d) => day(d, 5)) });
    const before = r.employees[0].finalSalary;
    const a = detectAnomalies(r, [emp({})]);
    expect(a.some((x) => x.category === 'ot')).toBe(true);
    expect(r.employees[0].finalSalary).toBe(before);
  });
  it('flags a large salary change inside the period', () => {
    const e = emp({ salaryHistory: [{ dailyRate: 5000, effectiveFrom: '2020-01-01' }, { dailyRate: 9000, effectiveFrom: '2026-11-04' }] });
    const r = computePayroll({ period: week, sites: [{ id: 'A', name: 'A' }], employees: [e], attendance: [day('2026-11-04', 0)] });
    expect(detectAnomalies(r, [e]).some((x) => x.category === 'salary')).toBe(true);
  });
  it('no flags for a normal week', () => {
    const r = computePayroll({ period: week, sites: [{ id: 'A', name: 'A' }], employees: [emp({})], attendance: [day('2026-11-02', 1)] });
    expect(detectAnomalies(r, [emp({})])).toEqual([]);
  });
});
