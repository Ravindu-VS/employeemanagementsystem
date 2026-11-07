/**
 * =====================================================
 * ATTENDANCE DOMAIN — single authoritative normalization
 * =====================================================
 * Every reader (attendance page, payroll, reports, dashboard, employee
 * detail) converts raw Firestore `simpleAttendance` documents into logical
 * allocations with `normalizeAttendance`. Nothing else interprets raw fields.
 *
 * Storage model (current, see services/attendance-service.ts):
 *   doc id  `${workerId}_${date}`          site attendance for one worker/day
 *   doc id  `${workerId}_${date}_driver`   driver shifts for one driver/day
 *   siteShifts: { [siteId]: { morning: boolean, evening: boolean } }
 *   siteOtHours: { [siteId]: number }
 * Each site lives under its own key, so saving Site B can never change Site A.
 *
 * Legacy documents (random ids, morningSite/eveningSite/otHours, siteVisits)
 * remain readable. Documents flagged `superseded` were folded into their
 * deterministic replacement and are ignored.
 */

import type { SimpleAttendance } from '@/types';

export type ShiftKind = 'morning' | 'evening' | 'visit';
export type AllocationKind = 'site' | 'driver';

/** One logical shift/visit: employee + date + (site | driver duty) + shift. */
export interface ShiftAllocation {
  workerId: string;
  workerName: string;
  date: string;
  kind: AllocationKind;
  siteId: string | null; // null for driver duty
  shift: ShiftKind;
  sourceId: string;
  updatedAtMs: number;
}

/** OT hours recorded for employee + date + (site | driver duty). */
export interface OtAllocation {
  workerId: string;
  workerName: string;
  date: string;
  kind: AllocationKind;
  siteId: string | null;
  hours: number;
  sourceId: string;
  updatedAtMs: number;
}

export interface NormalizedAttendance {
  shifts: ShiftAllocation[];
  ot: OtAllocation[];
  /** Data-quality findings. Never silently change pay — they are surfaced. */
  anomalies: AttendanceAnomaly[];
}

export interface AttendanceAnomaly {
  workerId: string;
  date: string;
  message: string;
}

export interface SiteShiftState {
  morning: boolean;
  evening: boolean;
}

export const DRIVER_DUTY_ID = 'driver_duty';

// -----------------------------------------------------
// Deterministic document identity
// -----------------------------------------------------

function safeIdPart(v: string): string {
  return String(v).replace(/[\/\s]/g, '-');
}

export function siteAttendanceDocId(workerId: string, date: string): string {
  return `${safeIdPart(workerId)}_${date}`;
}

export function driverAttendanceDocId(workerId: string, date: string): string {
  return `${safeIdPart(workerId)}_${date}_driver`;
}

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------

function toMs(v: unknown): number {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  }
  const maybe = v as { toDate?: () => Date; seconds?: number };
  if (typeof maybe.toDate === 'function') return maybe.toDate().getTime();
  if (typeof maybe.seconds === 'number') return maybe.seconds * 1000;
  return 0;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function isDriverRecord(r: SimpleAttendance): boolean {
  return r.attendanceType === 'driver';
}

/**
 * Per-site shift state of a single raw site document (legacy or current).
 */
export function readSiteShifts(r: SimpleAttendance): Record<string, SiteShiftState & { visit: boolean }> {
  const out: Record<string, SiteShiftState & { visit: boolean }> = {};
  const ensure = (siteId: string) =>
    (out[siteId] ||= { morning: false, evening: false, visit: false });

  const shifts = (r as SimpleAttendance & { siteShifts?: Record<string, Partial<SiteShiftState>> }).siteShifts;
  if (shifts && typeof shifts === 'object') {
    for (const [siteId, s] of Object.entries(shifts)) {
      if (!s) continue;
      if (s.morning) ensure(siteId).morning = true;
      if (s.evening) ensure(siteId).evening = true;
    }
  } else {
    if (r.morningSite) ensure(r.morningSite).morning = true;
    if (r.eveningSite) ensure(r.eveningSite).evening = true;
  }
  for (const v of r.siteVisits || []) {
    if (v?.visited && v.siteId) ensure(v.siteId).visit = true;
  }
  return out;
}

/**
 * Normalize raw attendance documents into allocations.
 *
 * - only dates inside [range.start, range.end] (if a range is given)
 * - superseded documents ignored
 * - identical allocations from several documents collapse to one
 *   (key = worker | date | kind | site | shift)
 * - OT per worker/date/site: value from the most recently updated document
 */
export function normalizeAttendance(
  records: SimpleAttendance[],
  range?: { start: string; end: string }
): NormalizedAttendance {
  const shiftMap = new Map<string, ShiftAllocation>();
  const otMap = new Map<string, OtAllocation>();
  const anomalies: AttendanceAnomaly[] = [];

  for (const r of records) {
    if (!r || !r.workerId || !r.date) continue;
    if (r.superseded) continue;
    if (range && (r.date < range.start || r.date > range.end)) continue;

    const updatedAtMs = toMs(r.updatedAt) || toMs(r.createdAt);
    const base = { workerId: r.workerId, workerName: r.workerName || r.workerId, date: r.date, sourceId: r.id, updatedAtMs };

    const addShift = (kind: AllocationKind, siteId: string | null, shift: ShiftKind) => {
      const key = `${r.workerId}|${r.date}|${kind}|${siteId ?? '-'}|${shift}`;
      const prev = shiftMap.get(key);
      if (!prev || updatedAtMs > prev.updatedAtMs) shiftMap.set(key, { ...base, kind, siteId, shift });
    };
    const addOt = (kind: AllocationKind, siteId: string | null, hours: number) => {
      const key = `${r.workerId}|${r.date}|${kind}|${siteId ?? '-'}`;
      const prev = otMap.get(key);
      if (!prev || updatedAtMs > prev.updatedAtMs || (updatedAtMs === prev.updatedAtMs && r.id > prev.sourceId)) {
        otMap.set(key, { ...base, kind, siteId, hours });
      }
    };

    if (isDriverRecord(r)) {
      const morning = r.morningPresent ?? r.present ?? false;
      const evening = r.eveningPresent ?? r.present ?? false;
      if (morning) addShift('driver', null, 'morning');
      if (evening) addShift('driver', null, 'evening');
      const hasSplitOt = r.morningOtHours !== undefined || r.eveningOtHours !== undefined;
      const ot = hasSplitOt ? num(r.morningOtHours) + num(r.eveningOtHours) : num(r.otHours);
      // Zero is recorded too, so a later "0 OT" correction overrides an older value.
      if (ot > 0 || hasSplitOt || r.otHours !== undefined) addOt('driver', null, ot);
      continue;
    }

    const sites = readSiteShifts(r);
    for (const [siteId, s] of Object.entries(sites)) {
      if (s.morning) addShift('site', siteId, 'morning');
      if (s.evening) addShift('site', siteId, 'evening');
      if (s.visit) addShift('site', siteId, 'visit');
    }

    if (r.siteOtHours && Object.keys(r.siteOtHours).length > 0) {
      for (const [siteId, h] of Object.entries(r.siteOtHours)) addOt('site', siteId, num(h));
    } else if (num(r.otHours) > 0) {
      // Legacy record: one total OT value. Attribute to the single site the
      // record names (evening first — OT is worked after the evening shift).
      const siteIds = Object.keys(sites);
      const legacySite = r.eveningSite || r.morningSite || siteIds[0] || null;
      if (legacySite) {
        addOt('site', legacySite, num(r.otHours));
      } else {
        anomalies.push({ workerId: r.workerId, date: r.date, message: `${num(r.otHours)} OT hours recorded without any site — not paid` });
      }
    }
  }

  return {
    shifts: Array.from(shiftMap.values()),
    ot: Array.from(otMap.values()).filter((o) => o.hours > 0),
    anomalies,
  };
}

/**
 * Effective per-site state of ONE worker on ONE date, merged across every
 * (non-superseded) document — used by the attendance page and by the save
 * routine when folding legacy documents into the deterministic one.
 */
export function effectiveWorkerDay(
  records: SimpleAttendance[],
  workerId: string,
  date: string
): { sites: Record<string, SiteShiftState>; ot: Record<string, number> } {
  const mine = records.filter((r) => r.workerId === workerId && r.date === date && !isDriverRecord(r));
  const { shifts, ot } = normalizeAttendance(mine, { start: date, end: date });
  const sites: Record<string, SiteShiftState> = {};
  for (const s of shifts) {
    if (!s.siteId) continue;
    const st = (sites[s.siteId] ||= { morning: false, evening: false });
    if (s.shift === 'morning' || s.shift === 'visit') st.morning = true;
    if (s.shift === 'evening' || s.shift === 'visit') st.evening = true;
  }
  const otOut: Record<string, number> = {};
  for (const o of ot) if (o.siteId) otOut[o.siteId] = o.hours;
  return { sites, ot: otOut };
}

/**
 * Sites (ids) a worker is marked at on a date, across all documents.
 */
export function sitesMarkedForWorker(records: SimpleAttendance[], workerId: string, date: string): string[] {
  const { sites } = effectiveWorkerDay(records, workerId, date);
  return Object.entries(sites).filter(([, s]) => s.morning || s.evening).map(([id]) => id);
}
