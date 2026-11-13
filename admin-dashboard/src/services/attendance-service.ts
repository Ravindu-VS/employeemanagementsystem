/**
 * =====================================================
 * ATTENDANCE SERVICE
 * =====================================================
 * Firestore access for supervisor-marked attendance (`simpleAttendance`).
 *
 * Persistence model — deterministic, collision-safe document ids:
 *   `${workerId}_${date}`         site attendance of one worker on one day
 *   `${workerId}_${date}_driver`  driver shifts of one driver on one day
 * Per-site data lives under its own map key (siteShifts[siteId],
 * siteOtHours[siteId]), so saving one site never resets another site.
 *
 * Saving runs in ONE Firestore transaction per screen (all workers at once):
 * read current docs → apply only this site's changes → write. Legacy
 * random-id documents for the same worker/day are folded into the
 * deterministic document and flagged `superseded` (never deleted).
 * After commit the caller refetches from the server and the result is
 * verified (see verifySiteAttendance).
 */

import { getDocuments, where } from '@/lib/firebase/firestore';
import { doc, runTransaction, serverTimestamp, documentId, query, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COLLECTIONS } from '@/constants';
import {
  driverAttendanceDocId,
  effectiveWorkerDay,
  isDriverRecord,
  normalizeAttendance,
  siteAttendanceDocId,
  type SiteShiftState,
} from '@/domain/attendance';
import { isHigherRoleMultiSite } from '@/domain/roles';
import { createLogger } from '@/lib/logger';
import { auditAction } from './audit-service';
import type { BulkAttendanceEntry, DateRange, SimpleAttendance } from '@/types';
import { toISODateString } from '@/lib/date-utils';

const log = createLogger('AttendanceService');
const COL = COLLECTIONS.SIMPLE_ATTENDANCE;
const MAX_TX_WRITES = 450; // Firestore limit is 500 writes per transaction

// =====================================================
// READS
// =====================================================

/** All attendance documents (site + driver) for one date. */
export async function getSimpleAttendance(date: string): Promise<SimpleAttendance[]> {
  return getDocuments<SimpleAttendance>(COL, [where('date', '==', date)]);
}

/** All attendance documents for an inclusive date range. */
export async function getSimpleAttendanceForDateRange(startDate: string, endDate: string): Promise<SimpleAttendance[]> {
  return getDocuments<SimpleAttendance>(COL, [where('date', '>=', startDate), where('date', '<=', endDate)]);
}

/** Driver attendance documents for one date. */
export async function getDriverAttendance(date: string): Promise<SimpleAttendance[]> {
  const all = await getSimpleAttendance(date);
  return all.filter((r) => isDriverRecord(r) && !r.superseded);
}

/**
 * Attendance summary for one employee (employee detail page).
 * Uses the same normalization as payroll.
 */
export async function getEmployeeAttendanceSummary(
  employee: { uid: string; workerId?: string },
  dateRange: DateRange
): Promise<{ totalDays: number; presentDays: number; halfDays: number; overtimeHours: number; siteVisits: number }> {
  const ids = Array.from(new Set([employee.uid, employee.workerId].filter(Boolean))) as string[];
  if (ids.length === 0) return { totalDays: 0, presentDays: 0, halfDays: 0, overtimeHours: 0, siteVisits: 0 };
  const start = toISODateString(dateRange.start);
  const end = toISODateString(dateRange.end);
  const records = await getDocuments<SimpleAttendance>(COL, [where('workerId', 'in', ids)]);
  const { shifts, ot } = normalizeAttendance(records, { start, end });
  const perDay = new Map<string, number>();
  const visits = new Set<string>();
  for (const s of shifts) {
    perDay.set(s.date, Math.min(1, (perDay.get(s.date) || 0) + (s.shift === 'visit' ? 1 : 0.5)));
    if (s.siteId) visits.add(`${s.date}|${s.siteId}`);
  }
  const fractions = Array.from(perDay.values());
  return {
    totalDays: fractions.reduce((a, b) => a + b, 0),
    presentDays: fractions.filter((f) => f >= 1).length,
    halfDays: fractions.filter((f) => f > 0 && f < 1).length,
    overtimeHours: ot.reduce((a, o) => a + o.hours, 0),
    siteVisits: visits.size,
  };
}

// =====================================================
// SITE ATTENDANCE SAVE
// =====================================================

export interface SaveResult {
  success: number;
  failed: number;
  written: number;
  supersededLegacy: number;
  errors: string[];
}

/**
 * Save attendance for ONE site for many workers in a single transaction.
 * Only `siteShifts[siteId]` / `siteOtHours[siteId]` of each worker change.
 */
export async function bulkMarkSimpleAttendance(
  date: string,
  siteId: string,
  entries: BulkAttendanceEntry[],
  actorUid: string
): Promise<SaveResult> {
  if (!date || !siteId) throw new Error('Date and site are required');

  // Legacy documents (random ids) can only be found by query; new legacy
  // documents are never created any more, so reading them up front is safe.
  const dayDocs = await getSimpleAttendance(date);
  const legacyByWorker = new Map<string, SimpleAttendance[]>();
  for (const r of dayDocs) {
    if (isDriverRecord(r) || r.superseded) continue;
    if (r.id === siteAttendanceDocId(r.workerId, date)) continue;
    const list = legacyByWorker.get(r.workerId) || [];
    list.push(r);
    legacyByWorker.set(r.workerId, list);
  }

  const result: SaveResult = { success: 0, failed: 0, written: 0, supersededLegacy: 0, errors: [] };
  const chunkSize = Math.floor(MAX_TX_WRITES / 4);

  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize);
    // The callback may be retried by Firestore: keep per-attempt counters.
    const chunkResult = await runTransaction(db, async (tx) => {
      const r: SaveResult = { success: 0, failed: 0, written: 0, supersededLegacy: 0, errors: [] };
      const refs = chunk.map((e) => doc(db, COL, siteAttendanceDocId(e.workerId, date)));
      const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

      chunk.forEach((entry, idx) => {
        const ref = refs[idx];
        const snap = snaps[idx];
        const current = snap.exists() ? ({ id: snap.id, ...snap.data() } as SimpleAttendance) : null;
        const legacy = legacyByWorker.get(entry.workerId) || [];

        // Effective state across the deterministic doc + any legacy docs.
        const before = effectiveWorkerDay([...(current ? [current] : []), ...legacy], entry.workerId, date);
        const sites: Record<string, SiteShiftState> = { ...before.sites };
        const ot: Record<string, number> = { ...before.ot };

        // Apply ONLY this site's change.
        const morning = !!entry.morning;
        const evening = !!entry.evening;
        const otHours = Math.max(0, Number(entry.otHours) || 0);
        if (morning || evening) sites[siteId] = { morning, evening };
        else delete sites[siteId];
        if (otHours > 0) ot[siteId] = otHours;
        else delete ot[siteId];

        if (!isHigherRoleMultiSite(entry.role)) {
          // Labor: a shift can belong to only one site per day.
          const clash = Object.entries(sites).find(
            ([sid, st]) => sid !== siteId && ((morning && st.morning) || (evening && st.evening))
          );
          if (clash) {
            r.failed++;
            r.errors.push(`${entry.workerName}: shift already marked at another site on ${date}`);
            return;
          }
        }

        const isEmpty = Object.keys(sites).length === 0 && Object.keys(ot).length === 0;
        if (!current && legacy.length === 0 && isEmpty) {
          r.success++; // absent and nothing stored — nothing to write
          return;
        }
        const stored = current ? effectiveWorkerDay([current], entry.workerId, date) : null;
        const unchanged =
          stored &&
          legacy.length === 0 &&
          JSON.stringify(sortKeys(sites)) === JSON.stringify(sortKeys(stored.sites)) &&
          JSON.stringify(sortKeys(ot)) === JSON.stringify(sortKeys(stored.ot)) &&
          !!(current as SimpleAttendance & { siteShifts?: unknown }).siteShifts;
        if (unchanged) {
          r.success++;
          return;
        }

        // Legacy-compatible convenience fields (first site per shift).
        const morningSite = Object.entries(sites).find(([, st]) => st.morning)?.[0] ?? null;
        const eveningSite = Object.entries(sites).find(([, st]) => st.evening)?.[0] ?? null;
        const totalOt = Object.values(ot).reduce((a, b) => a + b, 0);

        tx.set(ref, {
          date,
          workerId: entry.workerId,
          workerName: entry.workerName,
          role: entry.role || 'helper',
          attendanceType: 'site',
          siteShifts: sites,
          siteOtHours: ot,
          otHours: totalOt,
          morningSite,
          eveningSite,
          siteVisits: [],
          supervisorId: actorUid,
          updatedBy: actorUid,
          updatedAt: serverTimestamp(),
          createdAt: current?.createdAt ?? serverTimestamp(),
          createdBy: current?.createdBy ?? actorUid,
        });
        r.written++;

        for (const old of legacy) {
          tx.update(doc(db, COL, old.id), { superseded: true, supersededBy: ref.id, supersededAt: serverTimestamp(), updatedBy: actorUid });
          r.supersededLegacy++;
        }
        r.success++;
      });
      return r;
    });

    result.success += chunkResult.success;
    result.failed += chunkResult.failed;
    result.written += chunkResult.written;
    result.supersededLegacy += chunkResult.supersededLegacy;
    result.errors.push(...chunkResult.errors);
  }

  log.info('Site attendance saved', { date, siteId, ...result });
  if (result.written > 0) {
    await auditAction('update', 'attendance', `${date}_${siteId}`, {
      newValue: { date, siteId, workersWritten: result.written, legacyFolded: result.supersededLegacy, failed: result.failed },
    });
  }
  return result;
}

function sortKeys<T extends Record<string, unknown>>(o: T): T {
  return Object.keys(o).sort().reduce((acc, k) => ({ ...acc, [k]: o[k] }), {} as T);
}

/**
 * Re-read the saved documents from the server and confirm that each worker's
 * state at `siteId` equals what was submitted. Returns mismatching names.
 */
export async function verifySiteAttendance(date: string, siteId: string, entries: BulkAttendanceEntry[]): Promise<string[]> {
  const ids = entries.map((e) => siteAttendanceDocId(e.workerId, date));
  const docs: SimpleAttendance[] = [];
  for (let i = 0; i < ids.length; i += 30) {
    const snap = await getDocs(query(collection(db, COL), where(documentId(), 'in', ids.slice(i, i + 30))));
    snap.forEach((d) => docs.push({ id: d.id, ...d.data() } as SimpleAttendance));
  }
  const mismatches: string[] = [];
  for (const e of entries) {
    const state = effectiveWorkerDay(docs, e.workerId, date);
    const s = state.sites[siteId] || { morning: false, evening: false };
    const ot = state.ot[siteId] || 0;
    if (s.morning !== !!e.morning || s.evening !== !!e.evening || ot !== Math.max(0, Number(e.otHours) || 0)) {
      mismatches.push(e.workerName);
    }
  }
  return mismatches;
}

// =====================================================
// DRIVER ATTENDANCE SAVE
// =====================================================

export interface DriverAttendanceEntry {
  workerId: string;
  workerName: string;
  morningPresent: boolean;
  eveningPresent: boolean;
  morningOtHours: number;
  eveningOtHours: number;
  remarks?: string;
}

/**
 * Save driver shifts (no site) for one date, all drivers in one transaction.
 */
export async function bulkMarkDriverAttendance(
  date: string,
  entries: DriverAttendanceEntry[],
  actorUid: string
): Promise<SaveResult> {
  const dayDocs = await getSimpleAttendance(date);
  const legacyByWorker = new Map<string, SimpleAttendance[]>();
  for (const r of dayDocs) {
    if (!isDriverRecord(r) || r.superseded) continue;
    if (r.id === driverAttendanceDocId(r.workerId, date)) continue;
    legacyByWorker.set(r.workerId, [...(legacyByWorker.get(r.workerId) || []), r]);
  }

  const result = await runTransaction(db, async (tx) => {
    const result: SaveResult = { success: 0, failed: 0, written: 0, supersededLegacy: 0, errors: [] };
    const refs = entries.map((e) => doc(db, COL, driverAttendanceDocId(e.workerId, date)));
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
    entries.forEach((e, idx) => {
      const morningOt = Math.max(0, Number(e.morningOtHours) || 0);
      const eveningOt = Math.max(0, Number(e.eveningOtHours) || 0);
      const hasLegacy = (legacyByWorker.get(e.workerId) || []).length > 0;
      if (!snaps[idx].exists() && !hasLegacy && !e.morningPresent && !e.eveningPresent && morningOt + eveningOt === 0 && !e.remarks) {
        result.success++; // absent, nothing stored — nothing to write
        return;
      }
      tx.set(refs[idx], {
        date,
        workerId: e.workerId,
        workerName: e.workerName,
        role: 'driver',
        attendanceType: 'driver',
        morningPresent: !!e.morningPresent,
        eveningPresent: !!e.eveningPresent,
        morningOtHours: morningOt,
        eveningOtHours: eveningOt,
        present: !!e.morningPresent || !!e.eveningPresent,
        otHours: morningOt + eveningOt,
        morningSite: null,
        eveningSite: null,
        remarks: e.remarks || null,
        supervisorId: actorUid,
        updatedBy: actorUid,
        updatedAt: serverTimestamp(),
        ...(snaps[idx].exists() ? {} : { createdAt: serverTimestamp(), createdBy: actorUid }),
      });
      result.written++;
      for (const old of legacyByWorker.get(e.workerId) || []) {
        tx.update(doc(db, COL, old.id), { superseded: true, supersededBy: refs[idx].id, supersededAt: serverTimestamp(), updatedBy: actorUid });
        result.supersededLegacy++;
      }
      result.success++;
    });
    return result;
  });
  log.info('Driver attendance saved', { date, ...result });
  if (result.written > 0) {
    await auditAction('update', 'attendance', `${date}_drivers`, { newValue: { date, driversWritten: result.written } });
  }
  return result;
}
