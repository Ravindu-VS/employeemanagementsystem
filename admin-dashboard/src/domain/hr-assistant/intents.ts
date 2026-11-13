/**
 * Questions answered from the signed-in person's OWN records (no documents,
 * no guessing). Anything else goes to document retrieval.
 */
import type { AdvanceRequest, Loan, WeeklyPayroll } from '@/types';
import type { LeaveBalance } from '@/domain/leave';

export type PersonalIntent = 'leave_balance' | 'last_payslip' | 'my_advances' | 'my_loans' | 'my_attendance';

const RULES: Array<[PersonalIntent, RegExp]> = [
  ['leave_balance', /\b(leave|holiday)s?\b.*\b(left|remain|balance|how many|have)\b|\b(my|remaining)\b.*\bleave\b/i],
  ['last_payslip', /\b(my|last|latest|this week'?s?)\b.*\b(pay ?slip|salary|pay|net)\b|\bwhy\b.*\b(salary|pay)\b.*\b(low|less|deduct)/i],
  ['my_advances', /\b(my|pending)\b.*\badvances?\b|\badvances?\b.*\b(status|pending|approved)\b/i],
  ['my_loans', /\b(my)\b.*\bloans?\b|\bloan\b.*\b(left|remain|balance)\b/i],
  ['my_attendance', /\b(my|how many)\b.*\b(attendance|days worked|shifts?)\b/i],
];

export function detectIntent(question: string): PersonalIntent | null {
  for (const [intent, re] of RULES) if (re.test(question)) return intent;
  return null;
}

export interface PersonalData {
  leaveBalances?: LeaveBalance[];
  payslips?: WeeklyPayroll[];
  advances?: AdvanceRequest[];
  loans?: Loan[];
  attendance?: { from: string; to: string; days: number; otHours: number };
}

const lkr = (n: number) => `LKR ${Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

export function answerPersonal(intent: PersonalIntent, d: PersonalData): string {
  switch (intent) {
    case 'leave_balance': {
      const b = d.leaveBalances || [];
      if (!b.length) return 'I could not find your leave records.';
      return 'Your leave this year: ' + b.map((x) => `${x.type} ${x.remaining} of ${x.entitlement} days left${x.pending ? ` (${x.pending} pending)` : ''}`).join('; ') + '.';
    }
    case 'last_payslip': {
      const p = [...(d.payslips || [])].sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate))[0];
      if (!p) return 'You do not have a stored payslip yet. Payslips appear after the weekly payroll is approved.';
      const adv = (p.advances || []).reduce((s, a) => s + a.amount, 0);
      const loan = (p.loanDeductions || []).reduce((s, l) => s + l.emiAmount, 0);
      const parts = [
        `Your latest payslip is for ${dmy(p.weekStartDate)} to ${dmy(p.weekEndDate)}: ${p.daysWorked} day(s)`,
        `${p.overtimeHours} OT hour(s)`,
        `gross ${lkr(p.totalEarnings)}`,
      ];
      const ded = [adv ? `advances ${lkr(adv)}` : '', loan ? `loan instalment ${lkr(loan)}` : ''].filter(Boolean);
      return `${parts.join(', ')}${ded.length ? `, less ${ded.join(' and ')}` : ''}, net ${lkr(p.netPay)} (${p.status}). You can download the PDF in My Portal.`;
    }
    case 'my_advances': {
      const a = d.advances || [];
      if (!a.length) return 'You have no advance requests.';
      const pending = a.filter((x) => x.status === 'pending');
      const waiting = a.filter((x) => x.status === 'approved' && !x.isDeducted);
      return [
        pending.length ? `${pending.length} pending approval (${lkr(pending.reduce((s, x) => s + x.amount, 0))})` : 'none pending approval',
        waiting.length ? `${waiting.length} approved and still to be deducted (${lkr(waiting.reduce((s, x) => s + x.amount, 0))})` : 'nothing waiting to be deducted',
      ].join('; ').replace(/^./, (c) => c.toUpperCase()) + '.';
    }
    case 'my_loans': {
      const l = (d.loans || []).filter((x) => x.status === 'active' || x.status === 'approved');
      if (!l.length) return 'You have no active loans.';
      return l.map((x) => `Loan ${lkr(x.totalAmount)}: ${x.paidEmis} of ${x.totalEmis} instalments paid, ${lkr(x.remainingAmount)} remaining (instalment ${lkr(x.emiAmount)}).`).join(' ');
    }
    case 'my_attendance': {
      const a = d.attendance;
      if (!a) return 'I could not load your attendance.';
      return `From ${dmy(a.from)} to ${dmy(a.to)} you worked ${a.days} day(s) with ${a.otHours} OT hour(s).`;
    }
  }
}
