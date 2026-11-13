/**
 * =====================================================
 * ANOMALY DETECTION (rule-based, explainable)
 * =====================================================
 * Flags unusual attendance / payroll for a human to review. It NEVER changes
 * attendance or pay. This is the integration point for future ML/AI models:
 * a model can add findings here; the payroll engine stays deterministic.
 */

import { ATTENDANCE_CONFIG } from '@/constants';
import type { PayrollEngineResult } from '@/domain/payroll';
import type { SalaryHistoryEntry, UserProfile } from '@/types';

export type AnomalySeverity = 'info' | 'warning' | 'critical';

export interface Anomaly {
  employeeId: string;
  employeeName: string;
  severity: AnomalySeverity;
  category: 'ot' | 'multi_site' | 'duplicate' | 'deduction' | 'salary' | 'data';
  message: string;
}

export interface AnomalyOptions {
  maxOtHoursPerWeek?: number;        // default: MAX_OVERTIME_HOURS × 6
  maxSupervisorSitesPerWeek?: number; // default 30 (≈ 5 sites/day)
  maxDeductionShare?: number;        // default 0.6 of gross
  salaryJumpShare?: number;          // default 0.3 (30 %)
}

function lastSalaryChange(history: SalaryHistoryEntry[] | undefined): { from: number; to: number; on: string } | null {
  const h = [...(history || [])].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  if (h.length < 2) return null;
  const a = h[h.length - 2];
  const b = h[h.length - 1];
  return { from: Number(a.dailyRate), to: Number(b.dailyRate), on: b.effectiveFrom };
}

export function detectAnomalies(result: PayrollEngineResult, employees: UserProfile[], opts: AnomalyOptions = {}): Anomaly[] {
  const maxOt = opts.maxOtHoursPerWeek ?? ATTENDANCE_CONFIG.MAX_OVERTIME_HOURS * 6;
  const maxVisits = opts.maxSupervisorSitesPerWeek ?? 30;
  const maxDed = opts.maxDeductionShare ?? 0.6;
  const jump = opts.salaryJumpShare ?? 0.3;
  const byUid = new Map(employees.map((e) => [e.uid, e]));
  const out: Anomaly[] = [];

  for (const e of result.employees) {
    const base = { employeeId: e.employeeId, employeeName: e.employeeName };
    if (e.otHours > maxOt) out.push({ ...base, severity: 'warning', category: 'ot', message: `${e.otHours} OT hours in the period (limit ${maxOt})` });
    if (e.visits > maxVisits) out.push({ ...base, severity: 'warning', category: 'multi_site', message: `${e.visits} site visits in the period` });
    if (e.gross > 0 && e.totalDeductions / e.gross > maxDed) {
      out.push({ ...base, severity: 'warning', category: 'deduction', message: `Deductions are ${Math.round((e.totalDeductions / e.gross) * 100)}% of gross` });
    }
    const change = lastSalaryChange(byUid.get(e.employeeId)?.salaryHistory);
    if (change && change.from > 0 && Math.abs(change.to - change.from) / change.from > jump && change.on >= result.period.start && change.on <= result.period.end) {
      out.push({ ...base, severity: 'info', category: 'salary', message: `Daily salary changed ${change.from} → ${change.to} on ${change.on}` });
    }
    for (const m of e.anomalies) {
      const category: Anomaly['category'] = /two sites|duplicate/i.test(m) ? 'duplicate' : /OT/.test(m) ? 'ot' : /exceed/.test(m) ? 'deduction' : 'data';
      out.push({ ...base, severity: /exceed|not found/i.test(m) ? 'critical' : 'warning', category, message: m });
    }
  }

  for (const s of result.sites) {
    const others = result.sites.filter((x) => x.siteId !== s.siteId);
    if (others.length >= 2) {
      const avg = others.reduce((a, x) => a + x.total, 0) / others.length;
      if (avg > 0 && s.total > avg * 3) {
        out.push({ employeeId: '', employeeName: s.siteName, severity: 'info', category: 'data', message: `Site total ${Math.round(s.total)} is over 3× the average of other sites` });
      }
    }
  }
  return out;
}
