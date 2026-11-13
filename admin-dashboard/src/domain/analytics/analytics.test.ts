import { describe, it, expect } from 'vitest';
import { buildWorkforceAnalytics, lastWeeks } from './index';
import { computePayroll } from '@/domain/payroll';
import type { SimpleAttendance, UserProfile } from '@/types';

const emp = (uid: string, role: string, dailyRate: number, isActive = true) => ({ uid, workerId: uid.toUpperCase(), displayName: uid, email: '', role, dailyRate, isActive }) as unknown as UserProfile;
let n = 0;
const day = (w: string, date: string, shifts: Record<string, { morning?: boolean; evening?: boolean }>, ot: Record<string, number> = {}) =>
  ({ id: `d${++n}`, workerId: w, workerName: w, date, supervisorId: 's', attendanceType: 'site', siteShifts: shifts, siteOtHours: ot, createdAt: new Date(n * 1000), updatedAt: new Date(n * 1000) }) as unknown as SimpleAttendance;

const employees = [emp('nimal', 'helper', 8000), emp('kamal', 'bass', 10000), emp('old', 'helper', 5000, false)];
const sites = [{ id: 'A', name: 'Site A' }, { id: 'B', name: 'Site B' }];
const attendance = [
  day('NIMAL', '2026-11-03', { A: { morning: true, evening: true } }, { A: 2 }),
  day('KAMAL', '2026-11-03', { B: { morning: true } }),
  day('NIMAL', '2026-11-10', { B: { morning: true, evening: true } }),
];

describe('workforce analytics', () => {
  it('lastWeeks gives Mon–Sun weeks ending with the current one', () => {
    expect(lastWeeks('2026-11-13', 2)).toEqual([{ start: '2026-11-02', end: '2026-11-08' }, { start: '2026-11-09', end: '2026-11-15' }]);
  });
  it('matches the payroll engine week by week', () => {
    const weeks = lastWeeks('2026-11-13', 2);
    const a = buildWorkforceAnalytics({ attendance, employees, sites }, weeks);
    const w1 = computePayroll({ period: weeks[0], attendance, employees, sites, includeDeductions: false });
    expect(a.weeks[0].gross).toBe(w1.totals.normalPay + w1.totals.otPay);
    expect(a.weeks[0]).toMatchObject({ peopleWorked: 2, days: 1.5, otHours: 2, normalPay: 13000, otPay: 2000, gross: 15000 });
    expect(a.weeks[1]).toMatchObject({ peopleWorked: 1, gross: 8000, otShare: 0 });
    expect(a.totals.gross).toBe(23000);
  });
  it('site utilisation, headcount and top OT', () => {
    const a = buildWorkforceAnalytics({ attendance, employees, sites }, lastWeeks('2026-11-13', 2));
    expect(a.sites.map((s) => s.siteId)).toEqual(['B', 'A']); // B 13,000 > A 10,000
    expect(a.sites.find((s) => s.siteId === 'B')).toMatchObject({ days: 1.5, total: 13000, avgPeoplePerWeek: 1 });
    expect(a.activeHeadcount).toBe(2);
    expect(a.inactiveHeadcount).toBe(1);
    expect(a.averageDailyRate).toBe(9000);
    expect(a.topOvertime).toEqual([{ employeeId: 'nimal', name: 'nimal', otHours: 2, otPay: 2000 }]);
  });
});
