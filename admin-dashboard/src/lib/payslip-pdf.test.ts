import { describe, it, expect } from 'vitest';
import { buildPayslipPdf } from './payslip-pdf';
import type { WeeklyPayroll } from '@/types';

const stored = {
  id: '2026-11-02_u', weekStartDate: '2026-11-02', weekEndDate: '2026-11-08', employeeId: 'u', workerId: 'WRK001',
  employeeName: 'Nimal Perera', employeeRole: 'helper', dailyRate: 8000, otRate: 1000,
  regularEarnings: 8000, overtimeEarnings: 5000, transportAllowance: 600, totalEarnings: 13600,
  siteBreakdowns: [{ siteId: 'A', siteName: 'Daminda Site', daysWorked: 1, otHours: 5, regularPay: 8000, otPay: 5000, totalPay: 13000 }],
  advances: [{ advanceId: 'a', amount: 5000, description: 'Personal advance', date: '2026-11-04' }],
  loanDeductions: [{ loanId: 'L', emiAmount: 2000, emiNumber: 3, totalEmis: 5, remainingAmount: 4000 }],
  totalDeductions: 7000, netPay: 6600, status: 'approved',
} as unknown as WeeklyPayroll;

// jsPDF writes text as hex or literal strings; extract all visible strings.
function pdfText(doc: ReturnType<typeof buildPayslipPdf>): string {
  const raw = doc.output();
  const lit = Array.from(raw.matchAll(/\((.*?)\)\s*Tj/g)).map((m) => m[1]);
  const hex = Array.from(raw.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)).map((m) => Buffer.from(m[1], 'hex').toString('latin1'));
  return [...lit, ...hex].join(' ');
}

describe('payslip PDF', () => {
  it('prints company branding and the stored figures only', () => {
    const doc = buildPayslipPdf(stored, { generatedAt: new Date('2026-11-09T06:00:00Z') });
    const text = pdfText(doc);
    expect(text).toContain('KK & SONS Architectural Services');
    expect(text).toContain('Weekly Payslip');
    expect(text).toContain('Week 02/11/2026 to 08/11/2026');
    expect(text).toContain('Nimal Perera');
    expect(text).toContain('Daminda Site');
    expect(text).toContain('LKR 13,600.00'); // gross
    expect(text).toContain('LKR 6,600.00');  // net
    expect(text).toContain('Less: advance Personal advance 04/11/2026');
    expect(text).toContain('All rights reserved');
    expect(doc.output()).toContain('/Author (KK & SONS Architectural Services)');
    expect(doc.output()).not.toMatch(/\("[^)]*\) Tj/); // no garbled Unicode fallback text
  });
});
