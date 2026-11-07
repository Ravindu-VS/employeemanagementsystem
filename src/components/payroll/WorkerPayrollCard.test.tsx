import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkerPayrollCard } from './WorkerPayrollCard';
import { GrandTotalCard } from './PayrollSummary';
import { computePayroll } from '@/domain/payroll';
import type { AdvanceRequest, SimpleAttendance, UserProfile } from '@/types';

const result = computePayroll({
  period: { start: '2026-11-02', end: '2026-11-08' },
  sites: [{ id: 'A', name: 'Daminda Site' }, { id: 'B', name: 'Premakirthi Site' }],
  employees: [{ uid: 'u', workerId: 'U', displayName: 'Nimal', role: 'helper', dailyRate: 8000, isActive: true } as UserProfile],
  attendance: [{ id: 'd', workerId: 'U', workerName: 'Nimal', date: '2026-11-04', attendanceType: 'site', siteShifts: { A: { morning: true }, B: { evening: true } }, siteOtHours: { A: 5 } } as unknown as SimpleAttendance],
  advances: [{ id: 'a', employeeId: 'u', amount: 5000, reason: 'Personal advance', status: 'approved', isDeducted: false, requestedAt: new Date('2026-11-04T12:00:00+05:30') } as AdvanceRequest],
});
const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('payroll UI renders engine output only', () => {
  it('expanded card shows sites, OT, advance with date, and final salary', () => {
    const html = strip(renderToStaticMarkup(<WorkerPayrollCard summary={result.employees[0]} isExpanded onToggle={() => {}} onToggleDeduction={() => {}} />));
    expect(html).toContain('Daminda Site');
    expect(html).toContain('Premakirthi Site');
    expect(html).toMatch(/Wed 04\/11\/2026/);
    // 0.5 day A (4,000) + 0.5 day B (4,000) + 5h OT at A (5,000) = 13,000 − 5,000 advance = 8,000
    expect(result.employees[0].gross).toBe(13000);
    expect(html).toMatch(/Gross salary\s*LKR\s*13,000/);
    expect(html).toMatch(/Final salary\s*LKR\s*8,000/);
  });
  it('grand total card shows the final payroll', () => {
    const html = strip(renderToStaticMarkup(<GrandTotalCard totals={result.totals} />));
    expect(html).toContain(`= Final payroll`);
    expect(result.totals.final).toBe(result.totals.gross - result.totals.advances - result.totals.loans);
  });
});
