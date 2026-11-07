import { describe, it, expect } from 'vitest';
import { computePayroll, DRIVER_DUTY_LINE_ID, type PayrollEngineInput } from './engine';
import { calculateOtRate, dailyRateOn } from './rates';
import type { AdvanceRequest, Loan, SimpleAttendance, UserProfile } from '@/types';

// Payroll week used throughout: Monday 02/11/2026 → Sunday 08/11/2026
const WEEK = { start: '2026-11-02', end: '2026-11-08' };
const SITES = [
  { id: 'A', name: 'Site A' },
  { id: 'B', name: 'Site B' },
  { id: 'C', name: 'Site C' },
  { id: 'D', name: 'Site D' },
];

let seq = 0;
function emp(p: Partial<UserProfile> & { uid: string }): UserProfile {
  return { workerId: p.uid.toUpperCase(), displayName: p.uid, email: '', role: 'helper', dailyRate: 8000, isActive: true, ...p } as UserProfile;
}
function att(p: Partial<SimpleAttendance> & { workerId: string; date: string }): SimpleAttendance {
  seq += 1;
  return { id: `doc${seq}`, workerName: p.workerId, supervisorId: 'sup', attendanceType: 'site', createdAt: new Date(seq * 1000), updatedAt: new Date(seq * 1000), ...p } as SimpleAttendance;
}
/** current storage format */
function siteDay(workerId: string, date: string, shifts: Record<string, { morning?: boolean; evening?: boolean }>, ot: Record<string, number> = {}) {
  return att({ workerId, date, siteShifts: shifts, siteOtHours: ot } as Partial<SimpleAttendance> & { workerId: string; date: string });
}
function run(partial: Partial<PayrollEngineInput>) {
  return computePayroll({ period: WEEK, attendance: [], employees: [], sites: SITES, ...partial });
}
const nimal = emp({ uid: 'nimal', role: 'helper', dailyRate: 8000 });
const kanchana = emp({ uid: 'kanchana', role: 'supervisor', dailyRate: 8000 });
const nuwan = emp({ uid: 'nuwan', role: 'driver', dailyRate: 6000 });

describe('OT rule', () => {
  it('OT rate = daily salary ÷ 8', () => {
    expect(calculateOtRate(8000)).toBe(1000);
  });

  it('8,000 daily + 5 OT hours → normal 8,000, OT 5,000, total 13,000', () => {
    const r = run({ employees: [nimal], attendance: [siteDay('NIMAL', '2026-11-03', { A: { morning: true, evening: true } }, { A: 5 })] });
    const e = r.employees[0];
    expect(e.normalPay).toBe(8000);
    expect(e.otPay).toBe(5000);
    expect(e.gross).toBe(13000);
    expect(e.finalSalary).toBe(13000);
  });

  it('ignores any stored otRate field', () => {
    const r = run({ employees: [{ ...nimal, otRate: 99999 }], attendance: [siteDay('NIMAL', '2026-11-03', { A: { morning: true } }, { A: 1 })] });
    expect(r.employees[0].otPay).toBe(1000);
  });
});

describe('Multi-site labor attendance', () => {
  it('1 worker / 1 site full day', () => {
    const r = run({ employees: [nimal], attendance: [siteDay('NIMAL', '2026-11-03', { A: { morning: true, evening: true } })] });
    expect(r.employees[0].sites).toHaveLength(1);
    expect(r.employees[0].sites[0]).toMatchObject({ siteId: 'A', days: 1, normalPay: 8000 });
  });

  it('half day = 0.5', () => {
    const r = run({ employees: [nimal], attendance: [siteDay('NIMAL', '2026-11-03', { A: { morning: true } })] });
    expect(r.employees[0].daysWorked).toBe(0.5);
    expect(r.employees[0].gross).toBe(4000);
  });

  it('Morning Site A + Evening Site B → 0.5 + 0.5 = 1 day', () => {
    const r = run({ employees: [nimal], attendance: [siteDay('NIMAL', '2026-11-03', { A: { morning: true }, B: { evening: true } })] });
    const e = r.employees[0];
    expect(e.sites.find((s) => s.siteId === 'A')!.days).toBe(0.5);
    expect(e.sites.find((s) => s.siteId === 'B')!.days).toBe(0.5);
    expect(e.daysWorked).toBe(1);
    expect(e.gross).toBe(8000);
  });

  it('Site A OT = 3, Site B OT = 0 → only Site A receives OT', () => {
    const r = run({
      employees: [nimal],
      attendance: [siteDay('NIMAL', '2026-11-03', { A: { morning: true }, B: { evening: true } }, { A: 3 })],
    });
    const e = r.employees[0];
    expect(e.sites.find((s) => s.siteId === 'A')!.otHours).toBe(3);
    expect(e.sites.find((s) => s.siteId === 'B')!.otHours).toBe(0);
    expect(e.otHours).toBe(3);
    expect(r.sites.find((s) => s.siteId === 'B')!.otHours).toBe(0);
  });

  it('legacy records: morningSite/eveningSite + otHours still readable', () => {
    const r = run({ employees: [nimal], attendance: [att({ workerId: 'NIMAL', date: '2026-11-04', morningSite: 'A', eveningSite: 'B', otHours: 2 })] });
    const e = r.employees[0];
    expect(e.daysWorked).toBe(1);
    // legacy single OT value goes to the evening site only
    expect(e.sites.find((s) => s.siteId === 'B')!.otHours).toBe(2);
    expect(e.sites.find((s) => s.siteId === 'A')!.otHours).toBe(0);
  });

  it('legacy duplicate docs for different sites are NOT merged away (Premakirthi/Nimal bug)', () => {
    // Two random-id docs created by concurrent saves at two sites
    const r = run({
      employees: [nimal],
      attendance: [
        att({ workerId: 'NIMAL', date: '2026-11-02', morningSite: 'A', eveningSite: 'A' }),
        att({ workerId: 'NIMAL', date: '2026-11-03', morningSite: 'A' }),
        att({ workerId: 'NIMAL', date: '2026-11-03', eveningSite: 'B' }),
        att({ workerId: 'NIMAL', date: '2026-11-04', morningSite: 'A', eveningSite: 'A' }),
      ],
    });
    const e = r.employees[0];
    expect(e.sites.find((s) => s.siteId === 'A')!.days).toBe(2.5);
    expect(e.sites.find((s) => s.siteId === 'B')!.days).toBe(0.5);
    expect(e.daysWorked).toBe(3);
  });

  it('identical duplicate docs are counted once', () => {
    const r = run({
      employees: [nimal],
      attendance: [
        att({ workerId: 'NIMAL', date: '2026-11-02', morningSite: 'A', eveningSite: 'A' }),
        att({ workerId: 'NIMAL', date: '2026-11-02', morningSite: 'A', eveningSite: 'A' }),
      ],
    });
    expect(r.employees[0].daysWorked).toBe(1);
  });

  it('superseded documents are ignored', () => {
    const r = run({
      employees: [nimal],
      attendance: [
        att({ workerId: 'NIMAL', date: '2026-11-02', morningSite: 'A', eveningSite: 'A', superseded: true }),
        siteDay('NIMAL', '2026-11-02', { A: { morning: false, evening: false } }),
      ],
    });
    expect(r.employees).toHaveLength(0);
  });
});

describe('Supervisor', () => {
  it('visits 4 sites at 2,000/site → 8,000 with site breakdown preserved', () => {
    const r = run({
      employees: [kanchana],
      attendance: [siteDay('KANCHANA', '2026-11-03', { A: { morning: true }, B: { morning: true }, C: { evening: true }, D: { morning: true, evening: true } })],
    });
    const e = r.employees[0];
    expect(e.sites).toHaveLength(4);
    expect(e.sites.every((s) => s.visits === 1 && s.normalPay === 2000)).toBe(true);
    expect(e.visits).toBe(4);
    expect(e.gross).toBe(8000);
  });

  it('visiting the same site twice in a day is still one allocation', () => {
    const r = run({
      employees: [kanchana],
      attendance: [
        siteDay('KANCHANA', '2026-11-03', { A: { morning: true, evening: true } }),
        att({ workerId: 'KANCHANA', date: '2026-11-03', siteVisits: [{ siteId: 'A', visited: true, visitedAt: '' }, { siteId: 'A', visited: true, visitedAt: '' }] }),
      ],
    });
    expect(r.employees[0].visits).toBe(1);
    expect(r.employees[0].gross).toBe(2000);
  });

  it('settings and per-employee site-visit rate are respected', () => {
    const viaSettings = run({ employees: [kanchana], settings: { supervisorSiteVisitRate: 2500 }, attendance: [siteDay('KANCHANA', '2026-11-03', { A: { morning: true } })] });
    expect(viaSettings.employees[0].gross).toBe(2500);
    const viaEmployee = run({ employees: [{ ...kanchana, siteVisitRate: 3000 }], settings: { supervisorSiteVisitRate: 2500 }, attendance: [siteDay('KANCHANA', '2026-11-03', { A: { morning: true } })] });
    expect(viaEmployee.employees[0].gross).toBe(3000);
  });

  it('Helper promoted to Supervisor is paid by the current (Supervisor) rule', () => {
    const promoted = { ...kanchana, role: 'supervisor' as const };
    const r = run({ employees: [promoted], attendance: [att({ workerId: 'KANCHANA', date: '2026-11-03', role: 'helper', morningSite: 'A', eveningSite: 'B' })] });
    expect(r.employees[0].visits).toBe(2);
    expect(r.employees[0].gross).toBe(4000);
  });

  it('supervisor OT uses daily ÷ 8 and stays at its site', () => {
    const r = run({ employees: [kanchana], attendance: [siteDay('KANCHANA', '2026-11-03', { A: { morning: true }, B: { morning: true } }, { B: 2 })] });
    const e = r.employees[0];
    expect(e.sites.find((s) => s.siteId === 'B')!.otPay).toBe(2000);
    expect(e.sites.find((s) => s.siteId === 'A')!.otPay).toBe(0);
    expect(e.gross).toBe(6000);
  });
});

describe('Driver', () => {
  it('daily salary by shifts, never site payroll', () => {
    const r = run({
      employees: [nuwan],
      attendance: [
        att({ workerId: 'NUWAN', date: '2026-11-02', attendanceType: 'driver', morningPresent: true, eveningPresent: true, morningOtHours: 1, eveningOtHours: 1 }),
        att({ workerId: 'NUWAN', date: '2026-11-03', attendanceType: 'driver', morningPresent: true, eveningPresent: false }),
      ],
    });
    const e = r.employees[0];
    expect(e.sites).toHaveLength(1);
    expect(e.sites[0].siteId).toBe(DRIVER_DUTY_LINE_ID);
    expect(e.daysWorked).toBe(1.5);
    expect(e.normalPay).toBe(9000);
    expect(e.otPay).toBe(1500); // 2h × 6000/8
    expect(r.sites).toHaveLength(0);
    expect(r.totals.driverTotal).toBe(10500);
  });
});

describe('Weekly period filtering', () => {
  it('worker who worked last week but not this week → 0 / not in payroll', () => {
    const r = run({ employees: [nimal], attendance: [siteDay('NIMAL', '2026-10-30', { A: { morning: true, evening: true } }, { A: 2 })] });
    expect(r.employees).toHaveLength(0);
    expect(r.totals.final).toBe(0);
  });

  it('future attendance is excluded', () => {
    const r = run({ employees: [nimal], attendance: [siteDay('NIMAL', '2026-11-09', { A: { morning: true } })] });
    expect(r.employees).toHaveLength(0);
  });

  it('emergency Sunday attendance counts in the Monday–Sunday week', () => {
    const nadhan = emp({ uid: 'nadhan', dailyRate: 7000 });
    const r = run({ employees: [nimal, nadhan], attendance: [siteDay('NIMAL', '2026-11-08', { A: { morning: true, evening: true } }), siteDay('NADHAN', '2026-11-08', { A: { morning: true } })] });
    expect(r.employees.find((e) => e.employeeId === 'nimal')!.gross).toBe(8000);
    expect(r.employees.find((e) => e.employeeId === 'nadhan')!.gross).toBe(3500);
  });

  it('excludeDates prevents paying dates already in a stored payroll', () => {
    const r = run({
      employees: [nimal],
      excludeDates: new Map([['nimal', new Set(['2026-11-02'])]]),
      attendance: [siteDay('NIMAL', '2026-11-02', { A: { morning: true, evening: true } }), siteDay('NIMAL', '2026-11-03', { A: { morning: true, evening: true } })],
    });
    expect(r.employees[0].daysWorked).toBe(1);
  });

  it('inactive employees keep their attendance in payroll history', () => {
    const r = run({ employees: [{ ...nimal, isActive: false }], attendance: [siteDay('NIMAL', '2026-11-02', { A: { morning: true } })] });
    expect(r.employees[0].gross).toBe(4000);
    expect(r.employees[0].isActive).toBe(false);
  });
});

describe('Salary history', () => {
  it('uses the daily salary applicable on each date', () => {
    const e = { ...nimal, dailyRate: 9000, salaryHistory: [{ dailyRate: 8000, effectiveFrom: '2020-01-01' }, { dailyRate: 9000, effectiveFrom: '2026-11-04' }] };
    expect(dailyRateOn(e, '2026-11-03')).toBe(8000);
    expect(dailyRateOn(e, '2026-11-04')).toBe(9000);
    const r = run({
      employees: [e],
      attendance: [siteDay('NIMAL', '2026-11-03', { A: { morning: true, evening: true } }, { A: 1 }), siteDay('NIMAL', '2026-11-04', { A: { morning: true, evening: true } }, { A: 1 })],
    });
    expect(r.employees[0].normalPay).toBe(17000);
    expect(r.employees[0].otPay).toBe(1000 + 1125);
  });
});

function advance(p: Partial<AdvanceRequest> & { id: string; employeeId: string; amount: number }): AdvanceRequest {
  return { employeeName: '', reason: 'Personal advance', requestedAt: new Date('2026-11-04T12:00:00+05:30'), status: 'approved', isDeducted: false, carryForward: false, deductThisWeek: true, createdAt: new Date(), updatedAt: new Date(), ...p } as AdvanceRequest;
}

describe('Advances', () => {
  const week = [siteDay('NIMAL', '2026-11-02', { A: { morning: true, evening: true } }), siteDay('NIMAL', '2026-11-03', { A: { morning: true, evening: true } })];

  it('deduct checked → final reduced by 5,000; date shown', () => {
    const r = run({ employees: [nimal], attendance: week, advances: [advance({ id: 'adv1', employeeId: 'nimal', amount: 5000 })] });
    const e = r.employees[0];
    expect(e.gross).toBe(16000);
    expect(e.advances[0]).toMatchObject({ date: '2026-11-04', amount: 5000, deduct: true });
    expect(e.advanceDeduction).toBe(5000);
    expect(e.finalSalary).toBe(11000);
  });

  it('deduct unchecked → payroll unchanged, amount carried forward and offered next week', () => {
    const adv = advance({ id: 'adv1', employeeId: 'nimal', amount: 5000 });
    const r = run({ employees: [nimal], attendance: week, advances: [adv], advanceSelections: { adv1: false } });
    expect(r.employees[0].finalSalary).toBe(16000);
    expect(r.employees[0].advanceCarriedForward).toBe(5000);
    // next week: still outstanding (not deducted) → available again
    const next = computePayroll({ period: { start: '2026-11-09', end: '2026-11-15' }, sites: SITES, employees: [nimal], advances: [adv], attendance: [siteDay('NIMAL', '2026-11-10', { A: { morning: true, evening: true } })] });
    expect(next.employees[0].advances.map((a) => a.id)).toEqual(['adv1']);
    expect(next.employees[0].advanceDeduction).toBe(5000);
  });

  it('rejected, pending and already-deducted advances are never deducted', () => {
    const r = run({
      employees: [nimal], attendance: week,
      advances: [
        advance({ id: 'r', employeeId: 'nimal', amount: 1000, status: 'rejected' }),
        advance({ id: 'p', employeeId: 'nimal', amount: 1000, status: 'pending' }),
        advance({ id: 'd', employeeId: 'nimal', amount: 1000, isDeducted: true }),
        { ...advance({ id: 'd2', employeeId: 'nimal', amount: 1000 }), deducted: true } as AdvanceRequest,
      ],
    });
    expect(r.employees[0].advanceDeduction).toBe(0);
  });

  it('advance dated after the payroll week is not offered yet', () => {
    const r = run({ employees: [nimal], attendance: week, advances: [advance({ id: 'f', employeeId: 'nimal', amount: 1000, requestedAt: new Date('2026-11-12T12:00:00+05:30') })] });
    expect(r.employees[0].advances).toHaveLength(0);
  });

  it('advance stored against workerId is matched too', () => {
    const r = run({ employees: [nimal], attendance: week, advances: [advance({ id: 'w', employeeId: 'NIMAL', amount: 1000 })] });
    expect(r.employees[0].advanceDeduction).toBe(1000);
  });
});

describe('Loans, transport and multiple deductions', () => {
  const loan = { id: 'L1', employeeId: 'nimal', emiAmount: 2000, remainingAmount: 6000, paidEmis: 2, totalEmis: 5, status: 'active' } as Loan;

  it('loan instalment deducted and remaining balance shown', () => {
    const r = run({ employees: [nimal], loans: [loan], attendance: [siteDay('NIMAL', '2026-11-02', { A: { morning: true, evening: true } })] });
    expect(r.employees[0].loans[0]).toMatchObject({ amount: 2000, emiNumber: 3, remainingAfter: 4000 });
    expect(r.employees[0].finalSalary).toBe(6000);
  });

  it('last instalment never exceeds remaining balance', () => {
    const r = run({ employees: [nimal], loans: [{ ...loan, remainingAmount: 500 }], attendance: [siteDay('NIMAL', '2026-11-02', { A: { morning: true, evening: true } })] });
    expect(r.employees[0].loanDeduction).toBe(500);
  });

  it('transport per day and distance band', () => {
    const perDay = { ...nimal, transportType: 'travel_allowance' as const, transportRate: 300, transportRateType: 'per_day' as const };
    const r1 = run({ employees: [perDay], attendance: [siteDay('NIMAL', '2026-11-02', { A: { morning: true, evening: true } }), siteDay('NIMAL', '2026-11-03', { A: { morning: true } })] });
    expect(r1.employees[0].transport).toBe(450);
    expect(r1.employees[0].gross).toBe(12000 + 450);

    const band = { ...nimal, transportType: 'travel_allowance' as const, distance: 25, transportRateType: 'distance_band' as const };
    const r2 = run({
      employees: [band],
      settings: { transportBands: [{ minKm: 0, maxKm: 20, ratePerDay: 200 }, { minKm: 20, maxKm: null, ratePerDay: 500 }] },
      attendance: [siteDay('NIMAL', '2026-11-02', { A: { morning: true, evening: true } })],
    });
    expect(r2.employees[0].transport).toBe(500);

    const company = { ...perDay, transportType: 'company_vehicle' as const };
    const r3 = run({ employees: [company], attendance: [siteDay('NIMAL', '2026-11-02', { A: { morning: true, evening: true } })] });
    expect(r3.employees[0].transport).toBe(0);
  });

  it('gross − advance − loan = final, and grand total reconciles with site totals', () => {
    const perDay = { ...nimal, transportType: 'travel_allowance' as const, transportRate: 300, transportRateType: 'per_day' as const };
    const r = run({
      employees: [perDay, kanchana, nuwan],
      loans: [loan],
      advances: [advance({ id: 'a1', employeeId: 'nimal', amount: 1500 }), advance({ id: 'a2', employeeId: 'kanchana', amount: 1000 }), advance({ id: 'a3', employeeId: 'kanchana', amount: 700 })],
      advanceSelections: { a3: false },
      attendance: [
        siteDay('NIMAL', '2026-11-02', { A: { morning: true }, B: { evening: true } }, { A: 2 }),
        siteDay('KANCHANA', '2026-11-02', { A: { morning: true }, B: { morning: true }, C: { morning: true } }),
        att({ workerId: 'NUWAN', date: '2026-11-02', attendanceType: 'driver', morningPresent: true, eveningPresent: true }),
      ],
    });
    const n = r.employees.find((e) => e.employeeId === 'nimal')!;
    expect(n.gross).toBe(8000 + 2000 + 300);
    expect(n.totalDeductions).toBe(1500 + 2000);
    expect(n.finalSalary).toBe(10300 - 3500);
    const k = r.employees.find((e) => e.employeeId === 'kanchana')!;
    expect(k.advanceDeduction).toBe(1000);
    expect(k.advanceCarriedForward).toBe(700);

    const t = r.totals;
    expect(t.siteTotal + t.driverTotal + t.transport).toBe(t.gross);
    expect(t.gross - t.advances - t.loans).toBe(t.final);
    expect(r.sites.find((s) => s.siteId === 'A')).toMatchObject({ employeeCount: 2, otHours: 2 });
    // employee totals and site totals cover the same money
    const empSiteSum = r.employees.reduce((s, e) => s + e.sites.reduce((x, l) => x + l.total, 0), 0);
    expect(empSiteSum).toBe(t.siteTotal + t.driverTotal);
  });
});

describe('Settings toggles', () => {
  it('autoDeductAdvances=false pre-selects carry forward; explicit tick still deducts', () => {
    const base = {
      employees: [nimal],
      attendance: [siteDay('NIMAL', '2026-11-02', { A: { morning: true, evening: true } })],
      advances: [advance({ id: 'x', employeeId: 'nimal', amount: 1000 })],
      settings: { autoDeductAdvances: false },
    };
    expect(run(base).employees[0].advanceDeduction).toBe(0);
    expect(run({ ...base, advanceSelections: { x: true } }).employees[0].advanceDeduction).toBe(1000);
  });
  it('autoDeductLoans=false skips loan instalments', () => {
    const r = run({
      employees: [nimal],
      attendance: [siteDay('NIMAL', '2026-11-02', { A: { morning: true, evening: true } })],
      loans: [{ id: 'L', employeeId: 'nimal', emiAmount: 500, remainingAmount: 500, paidEmis: 0, totalEmis: 1, status: 'active' } as Loan],
      settings: { autoDeductLoans: false },
    });
    expect(r.employees[0].loanDeduction).toBe(0);
  });
  it('changing workerId keeps old attendance linked (formerWorkerIds)', () => {
    const renamed = { ...nimal, workerId: 'WRK099', formerWorkerIds: ['NIMAL'] };
    const r = run({ employees: [renamed], attendance: [siteDay('NIMAL', '2026-11-02', { A: { morning: true } })] });
    expect(r.employees[0].employeeId).toBe('nimal');
    expect(r.employees[0].gross).toBe(4000);
  });
});
