/**
 * =====================================================
 * ONE-OFF LEGACY ATTENDANCE MIGRATION (plan only — pure)
 * =====================================================
 * Older versions saved attendance under random document IDs, sometimes
 * several per worker per day. This folds every worker/day into its
 * deterministic document ({workerId}_{date} or {workerId}_{date}_driver)
 * and flags the old documents `superseded` (never deleted).
 *
 * Guarantee (tested): normalizeAttendance(after) gives the same shifts and
 * OT as normalizeAttendance(before), so pay cannot change.
 */

import { driverAttendanceDocId, isDriverRecord, normalizeAttendance, siteAttendanceDocId } from './index';
import type { SimpleAttendance } from '@/types';

export interface MigrationItem {
  targetId: string;
  workerId: string;
  date: string;
  kind: 'site' | 'driver';
  /** Fields to write to the deterministic document (merged). */
  data: Record<string, unknown>;
  /** Random-ID documents to flag superseded. */
  supersede: string[];
}

export interface MigrationPlan {
  items: MigrationItem[];
  documentsScanned: number;
  legacyDocuments: number;
  alreadyClean: number;
}

const ms = (v: unknown) => {
  if (v instanceof Date) return v.getTime();
  const m = v as { toDate?: () => Date; seconds?: number } | undefined;
  if (m?.toDate) return m.toDate().getTime();
  if (typeof m?.seconds === 'number') return m.seconds * 1000;
  return typeof v === 'string' ? Date.parse(v) || 0 : 0;
};

export function planLegacyMigration(records: SimpleAttendance[]): MigrationPlan {
  const groups = new Map<string, SimpleAttendance[]>();
  let scanned = 0;
  for (const r of records) {
    if (!r?.workerId || !r.date || r.superseded) continue;
    scanned++;
    const kind = isDriverRecord(r) ? 'driver' : 'site';
    const key = `${kind}|${r.workerId}|${r.date}`;
    (groups.get(key) || groups.set(key, []).get(key)!).push(r);
  }

  const items: MigrationItem[] = [];
  let legacy = 0;
  let clean = 0;
  for (const [key, docs] of Array.from(groups.entries())) {
    const [kind, workerId, date] = key.split('|') as ['site' | 'driver', string, string];
    const targetId = kind === 'driver' ? driverAttendanceDocId(workerId, date) : siteAttendanceDocId(workerId, date);
    const others = docs.filter((d) => d.id !== targetId);
    if (others.length === 0) { clean++; continue; }
    legacy += others.length;

    const latest = [...docs].sort((a, b) => (ms(b.updatedAt) || ms(b.createdAt)) - (ms(a.updatedAt) || ms(a.createdAt)))[0];
    const n = normalizeAttendance(docs);
    const common = {
      date, workerId,
      workerName: latest.workerName || workerId,
      ...(latest.role ? { role: latest.role } : {}),
      supervisorId: latest.supervisorId || '',
      attendanceType: kind,
      migratedFrom: others.map((o) => o.id),
    };

    let data: Record<string, unknown>;
    if (kind === 'driver') {
      const ot = n.ot.reduce((s, o) => s + o.hours, 0);
      data = {
        ...common,
        morningPresent: n.shifts.some((s) => s.shift === 'morning'),
        eveningPresent: n.shifts.some((s) => s.shift === 'evening'),
        present: n.shifts.length > 0,
        otHours: ot,
        ...(latest.remarks ? { remarks: latest.remarks } : {}),
      };
    } else {
      const siteShifts: Record<string, { morning: boolean; evening: boolean }> = {};
      const visits: Array<{ siteId: string; visited: true; visitedAt: string }> = [];
      for (const s of n.shifts) {
        if (!s.siteId) continue;
        if (s.shift === 'visit') { visits.push({ siteId: s.siteId, visited: true, visitedAt: `${date}T12:00:00+05:30` }); continue; }
        const e = (siteShifts[s.siteId] ||= { morning: false, evening: false });
        e[s.shift] = true;
      }
      const siteOtHours: Record<string, number> = {};
      for (const o of n.ot) if (o.siteId) siteOtHours[o.siteId] = o.hours;
      const morningSite = Object.keys(siteShifts).find((k) => siteShifts[k].morning) || null;
      const eveningSite = Object.keys(siteShifts).find((k) => siteShifts[k].evening) || null;
      data = {
        ...common,
        siteShifts,
        siteOtHours,
        otHours: Object.values(siteOtHours).reduce((s, h) => s + h, 0),
        morningSite,
        eveningSite,
        siteVisits: visits,
      };
    }
    items.push({ targetId, workerId, date, kind, data, supersede: others.map((o) => o.id) });
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.workerId.localeCompare(b.workerId));
  return { items, documentsScanned: scanned, legacyDocuments: legacy, alreadyClean: clean };
}
