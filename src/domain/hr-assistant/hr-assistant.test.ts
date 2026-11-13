import { describe, it, expect } from 'vitest';
import { BUILTIN_HR_DOCS, answerPersonal, chunk, detectIntent, extractiveAnswer, search, tokenize } from './index';
import type { WeeklyPayroll } from '@/types';

describe('retrieval', () => {
  it('tokenizes without stop words and folds plurals', () => {
    expect(tokenize('How are my advances deducted?')).toEqual(['advance', 'deducted']);
  });
  it('chunks long documents into passages', () => {
    const long = { id: 'x', title: 'T', content: Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here.`).join(' ') };
    const parts = chunk(long, 200);
    expect(parts.length).toBeGreaterThan(3);
    expect(parts.every((p) => p.text.length <= 230)).toBe(true);
  });
  it('finds the right built-in passage and cites it', () => {
    const top = search(BUILTIN_HR_DOCS, 'what is the overtime OT rate?');
    expect(top[0].docId).toBe('builtin-payroll');
    expect(extractiveAnswer('what is the OT rate', top)).toMatch(/divided by 8/);
    expect(search(BUILTIN_HR_DOCS, 'how many sick leave days')[0].docId).toBe('builtin-leave');
    expect(search(BUILTIN_HR_DOCS, 'supervisor site visit pay')[0].text).toMatch(/2,000/);
  });
  it('returns nothing for unrelated questions', () => {
    expect(search(BUILTIN_HR_DOCS, 'zebra quantum')).toEqual([]);
  });
  it('custom documents outrank when more specific', () => {
    const docs = [...BUILTIN_HR_DOCS, { id: 'helmet', title: 'Helmet policy', content: 'Hard hats must be worn on every site at all times.' }];
    expect(search(docs, 'do I need a hard hat')[0].docId).toBe('helmet');
  });
});

describe('personal intents', () => {
  it('detects intents', () => {
    expect(detectIntent('How many leave days do I have left?')).toBe('leave_balance');
    expect(detectIntent('Explain my last payslip')).toBe('last_payslip');
    expect(detectIntent('why is my salary low this week')).toBe('last_payslip');
    expect(detectIntent('status of my advance')).toBe('my_advances');
    expect(detectIntent('how much is left on my loan')).toBe('my_loans');
    expect(detectIntent('what is the OT rate')).toBeNull();
  });
  it('explains a payslip from stored numbers', () => {
    const p = { weekStartDate: '2026-11-02', weekEndDate: '2026-11-08', daysWorked: 2, overtimeHours: 5, totalEarnings: 13600, netPay: 6600, status: 'approved', advances: [{ advanceId: 'a', amount: 5000, description: '' }], loanDeductions: [{ loanId: 'l', emiAmount: 2000, emiNumber: 1, totalEmis: 5 }] } as unknown as WeeklyPayroll;
    const t = answerPersonal('last_payslip', { payslips: [p] });
    expect(t).toContain('02/11/2026 to 08/11/2026');
    expect(t).toContain('gross LKR 13,600.00');
    expect(t).toContain('less advances LKR 5,000.00 and loan instalment LKR 2,000.00');
    expect(t).toContain('net LKR 6,600.00');
  });
  it('leave balance text', () => {
    expect(answerPersonal('leave_balance', { leaveBalances: [{ type: 'annual', entitlement: 14, used: 4, pending: 2, remaining: 10 }] })).toBe('Your leave this year: annual 10 of 14 days left (2 pending).');
  });
});
