/**
 * Built-in company rules, written from the same constants the payroll engine
 * uses, so the assistant can answer before any HR document is uploaded.
 */
import { COMPANY, PAYROLL_CONFIG } from '@/constants';
import { DEFAULT_LEAVE_SETTINGS } from '@/domain/leave';
import type { KnowledgeDoc } from './retrieval';

const lkr = (n: number) => `LKR ${n.toLocaleString('en-LK')}`;

export const BUILTIN_HR_DOCS: KnowledgeDoc[] = [
  {
    id: 'builtin-payroll',
    title: 'How weekly pay is calculated',
    content: `The payroll week runs Monday to Saturday. Sunday is the weekly holiday; Sunday work is only paid when it was marked as emergency work.

Normal pay for a day is your daily salary. A half day (morning only or evening only) is half of the daily salary.

Overtime (OT) rate is your daily salary divided by 8 for each OT hour. For example a daily salary of ${lkr(8000)} gives an OT rate of ${lkr(1000)} per hour. OT is recorded per site.

When you work at more than one site on the same day the day is split between the sites, and each site's OT is paid at your OT rate.

Supervisors are paid per site visit. The default is ${lkr(PAYROLL_CONFIG.DEFAULT_SUPERVISOR_SITE_VISIT_RATE)} for each site visited, unless a different rate is set for that supervisor.

Drivers are paid a daily salary for driver duty in morning and evening shifts, not per site.

Net salary = normal pay + OT pay + transport allowance − advances deducted − loan instalment. Your payslip shows each of these lines.`,
  },
  {
    id: 'builtin-advances',
    title: 'Salary advances and loans',
    content: `You can request a salary advance from My Portal. A manager, the CEO or the Owner approves or rejects it, and you get a notification.

An approved advance is deducted from the next payroll by default. A payroll admin may carry it forward to a later week instead; carried-forward advances are listed on the payslip.

A deducted advance can never be deducted twice.

Loans are repaid in equal weekly instalments taken from your salary until the remaining amount is zero.`,
  },
  {
    id: 'builtin-leave',
    title: 'Leave policy',
    content: `Each calendar year you are entitled to ${DEFAULT_LEAVE_SETTINGS.annualDays} days annual leave, ${DEFAULT_LEAVE_SETTINGS.sickDays} days sick leave and ${DEFAULT_LEAVE_SETTINGS.casualDays} days casual leave (an admin may change these in Settings).

Leave days count Monday to Saturday only; Sundays are not counted.

Request leave from the Leave page. A manager, the CEO or the Owner approves it and you get a notification.

Leave is unpaid for daily-wage staff: pay is based on attendance, so leave does not add or remove pay by itself.`,
  },
  {
    id: 'builtin-attendance',
    title: 'Attendance',
    content: `Supervisors and managers mark attendance per site with morning and evening shifts, and record OT hours per site.

All dates and times use Sri Lanka time (Asia/Colombo).

You can see your own attendance for any week in My Portal. If something is wrong, tell your supervisor; corrections are recorded in the audit log.`,
  },
  {
    id: 'builtin-transport',
    title: 'Transport allowance',
    content: `Employees who travel on their own may receive a transport allowance. It can be per km, per day, per week, per site or by distance band, as set on your employee record.

Employees who ride a company vehicle route do not receive a travel allowance for that travel.`,
  },
  {
    id: 'builtin-account',
    title: 'Accounts and access',
    content: `New sign-ups wait for approval. The Owner or CEO approves the account and assigns a role.

${COMPANY.NAME} staff can see their own attendance, payslips, advances, loans and leave in My Portal. Payroll and employee records are only visible to authorised roles.`,
  },
];
