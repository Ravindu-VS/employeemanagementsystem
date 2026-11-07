/**
 * Attendance persistence tests against an in-memory Firestore fake.
 * Covers spec §77 (save → refresh → change → save → refresh) for multiple
 * sites, morning/evening, supervisor, Sunday and drivers, plus legacy
 * duplicate folding and cross-site isolation (§24).
 * "Refresh" = read again from the store, exactly what the page does.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------- in-memory Firestore fake ----------------
type Data = Record<string, unknown>;
const store = new Map<string, Data>(); // key: `${collection}/${id}`
let clock = 1;
const SERVER_TS = { __serverTimestamp: true };

function resolveServer(v: unknown): unknown {
  if (v && typeof v === 'object' && (v as Data).__serverTimestamp) return new Date(clock++ * 1000);
  return v;
}
function materialize(data: Data): Data {
  const out: Data = {};
  for (const [k, v] of Object.entries(data)) out[k] = resolveServer(v);
  return out;
}
function snap(path: string) {
  const data = store.get(path);
  const id = path.split('/').pop()!;
  return { id, ref: { path, id }, exists: () => !!data, data: () => (data ? { ...data } : undefined) };
}
type Filter = { field: string; op: string; value: unknown };
function matches(data: Data, id: string, f: Filter): boolean {
  const v = f.field === '__name__' ? id : data[f.field];
  switch (f.op) {
    case '==': return v === f.value;
    case '>=': return (v as string) >= (f.value as string);
    case '<=': return (v as string) <= (f.value as string);
    case 'in': return (f.value as unknown[]).includes(v);
    default: throw new Error(`op ${f.op}`);
  }
}
function runQuery(col: string, filters: Filter[]) {
  const docs: Array<{ id: string; data: () => Data }> = [];
  for (const [path, data] of store) {
    const [c, id] = path.split('/');
    if (c !== col) continue;
    if (filters.every((f) => matches(data, id, f))) docs.push({ id, data: () => ({ ...data }) });
  }
  return docs;
}

vi.mock('@/lib/firebase/config', () => ({ db: {} }));
vi.mock('@/lib/firebase/firestore', () => ({
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
  getDocuments: async (col: string, filters: Filter[] = []) => runQuery(col, filters).map((d) => ({ id: d.id, ...d.data() })),
}));
vi.mock('firebase/firestore', () => ({
  serverTimestamp: () => SERVER_TS,
  documentId: () => '__name__',
  doc: (_db: unknown, col: string, id: string) => ({ path: `${col}/${id}`, id }),
  collection: (_db: unknown, col: string) => ({ col }),
  query: (c: { col: string }, ...filters: Filter[]) => ({ col: c.col, filters }),
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
  getDocs: async (q: { col: string; filters: Filter[] }) => {
    const docs = runQuery(q.col, q.filters);
    return { forEach: (cb: (d: { id: string; data: () => Data }) => void) => docs.forEach(cb), docs };
  },
  runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    const writes: Array<() => void> = [];
    const tx = {
      get: async (ref: { path: string }) => snap(ref.path),
      set: (ref: { path: string }, data: Data) => writes.push(() => store.set(ref.path, materialize(data))),
      update: (ref: { path: string }, data: Data) => writes.push(() => {
        const cur = store.get(ref.path);
        if (!cur) throw new Error(`update on missing doc ${ref.path}`);
        store.set(ref.path, { ...cur, ...materialize(data) });
      }),
    };
    const result = await fn(tx);
    writes.forEach((w) => w()); // atomic commit
    return result;
  },
}));
vi.mock('./audit-service', () => ({ auditAction: async () => {} }));
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ debug() {}, info() {}, warn() {}, error() {} }) }));

import { bulkMarkSimpleAttendance, bulkMarkDriverAttendance, getSimpleAttendance, verifySiteAttendance } from './attendance-service';
import { effectiveWorkerDay, normalizeAttendance, siteAttendanceDocId } from '@/domain/attendance';
import { computePayroll } from '@/domain/payroll';
import type { BulkAttendanceEntry, SimpleAttendance, UserProfile } from '@/types';

const MON = '2026-11-02';
const SUN = '2026-11-08';
const nimal: BulkAttendanceEntry = { workerId: 'W1', workerName: 'Nimal', role: 'helper', morning: false, evening: false, otHours: 0 };
const kanchana: BulkAttendanceEntry = { workerId: 'W2', workerName: 'Kanchana', role: 'supervisor', morning: false, evening: false, otHours: 0 };

async function stateAt(workerId: string, date: string, siteId: string) {
  const docs = await getSimpleAttendance(date); // "refresh"
  const { sites, ot } = effectiveWorkerDay(docs, workerId, date);
  return { ...(sites[siteId] || { morning: false, evening: false }), ot: ot[siteId] || 0 };
}

beforeEach(() => {
  store.clear();
  clock = 1;
});

describe('Present → Absent → Present persists (spec §22, §77)', () => {
  it('single site, full sequence including navigate away and back', async () => {
    await bulkMarkSimpleAttendance(MON, 'A', [{ ...nimal, morning: true, evening: true }], 'sup1');
    expect(await stateAt('W1', MON, 'A')).toMatchObject({ morning: true, evening: true });

    await bulkMarkSimpleAttendance(MON, 'A', [{ ...nimal, morning: false, evening: false }], 'sup1');
    expect(await stateAt('W1', MON, 'A')).toMatchObject({ morning: false, evening: false });
    // navigate away / return = another fresh read
    expect(await stateAt('W1', MON, 'A')).toMatchObject({ morning: false, evening: false });

    await bulkMarkSimpleAttendance(MON, 'A', [{ ...nimal, morning: true, evening: true }], 'sup1');
    expect(await stateAt('W1', MON, 'A')).toMatchObject({ morning: true, evening: true });
    // exactly one deterministic document
    expect(store.size).toBe(1);
    expect(store.has(`simpleAttendance/${siteAttendanceDocId('W1', MON)}`)).toBe(true);
  });

  it('verifySiteAttendance confirms the saved state from the store', async () => {
    const entry = { ...nimal, morning: true, otHours: 2 };
    await bulkMarkSimpleAttendance(MON, 'A', [entry], 'sup1');
    expect(await verifySiteAttendance(MON, 'A', [entry])).toEqual([]);
    expect(await verifySiteAttendance(MON, 'A', [{ ...entry, evening: true }])).toEqual(['Nimal']);
  });

  it('legacy duplicate docs are folded: the reverted-to-Present bug cannot happen', async () => {
    // Two legacy random-id docs for the same worker/day (old race condition)
    store.set('simpleAttendance/legacy1', { date: MON, workerId: 'W1', workerName: 'Nimal', morningSite: 'A', eveningSite: 'A', attendanceType: 'site', updatedAt: new Date(1) });
    store.set('simpleAttendance/legacy2', { date: MON, workerId: 'W1', workerName: 'Nimal', attendanceType: 'site', updatedAt: new Date(2) });
    expect(await stateAt('W1', MON, 'A')).toMatchObject({ morning: true, evening: true });

    await bulkMarkSimpleAttendance(MON, 'A', [{ ...nimal, morning: false, evening: false }], 'sup1');
    expect(await stateAt('W1', MON, 'A')).toMatchObject({ morning: false, evening: false });
    // legacy docs kept (history) but flagged superseded
    expect(store.get('simpleAttendance/legacy1')).toMatchObject({ superseded: true, morningSite: 'A' });
    expect(store.get('simpleAttendance/legacy2')).toMatchObject({ superseded: true });
  });
});

describe('Cross-site isolation (spec §24, §49)', () => {
  it('morning Site A + evening Site B saved from two screens; editing one never touches the other', async () => {
    await bulkMarkSimpleAttendance(MON, 'A', [{ ...nimal, morning: true, otHours: 2 }], 'sup1');
    await bulkMarkSimpleAttendance(MON, 'B', [{ ...nimal, evening: true }], 'sup2');
    expect(await stateAt('W1', MON, 'A')).toMatchObject({ morning: true, evening: false, ot: 2 });
    expect(await stateAt('W1', MON, 'B')).toMatchObject({ morning: false, evening: true, ot: 0 });

    // Edit Site B → Site A unchanged
    await bulkMarkSimpleAttendance(MON, 'B', [{ ...nimal, evening: false }], 'sup2');
    expect(await stateAt('W1', MON, 'A')).toMatchObject({ morning: true, ot: 2 });
    // Delete Site A → Site B unchanged
    await bulkMarkSimpleAttendance(MON, 'B', [{ ...nimal, evening: true }], 'sup2');
    await bulkMarkSimpleAttendance(MON, 'A', [{ ...nimal }], 'sup1');
    expect(await stateAt('W1', MON, 'B')).toMatchObject({ evening: true, ot: 0 });
    expect(await stateAt('W1', MON, 'A')).toMatchObject({ morning: false, ot: 0 });
  });

  it('labor cannot hold the same shift at two sites (rejected, other site intact)', async () => {
    await bulkMarkSimpleAttendance(MON, 'A', [{ ...nimal, morning: true }], 'sup1');
    const r = await bulkMarkSimpleAttendance(MON, 'B', [{ ...nimal, morning: true }], 'sup2');
    expect(r.failed).toBe(1);
    expect(await stateAt('W1', MON, 'A')).toMatchObject({ morning: true });
    expect(await stateAt('W1', MON, 'B')).toMatchObject({ morning: false });
  });
});

describe('Supervisor, Sunday and Driver persistence', () => {
  it('supervisor marked at 4 sites from 4 screens → 4 visits, 8,000', async () => {
    for (const s of ['A', 'B', 'C', 'D']) await bulkMarkSimpleAttendance(MON, s, [{ ...kanchana, morning: true }], 'mgr');
    const docs = await getSimpleAttendance(MON);
    const r = computePayroll({
      period: { start: MON, end: SUN },
      attendance: docs,
      employees: [{ uid: 'u2', workerId: 'W2', displayName: 'Kanchana', role: 'supervisor', dailyRate: 8000, isActive: true } as UserProfile],
      sites: ['A', 'B', 'C', 'D'].map((id) => ({ id, name: id })),
    });
    expect(r.employees[0].visits).toBe(4);
    expect(r.employees[0].gross).toBe(8000);
    // unmark C → 3 visits, others unchanged
    await bulkMarkSimpleAttendance(MON, 'C', [{ ...kanchana }], 'mgr');
    const after = normalizeAttendance(await getSimpleAttendance(MON)).shifts.map((s) => s.siteId).sort();
    expect(after).toEqual(['A', 'B', 'D']);
  });

  it('emergency Sunday attendance persists and toggles', async () => {
    await bulkMarkSimpleAttendance(SUN, 'A', [{ ...nimal, morning: true, evening: true }], 'sup1');
    expect(await stateAt('W1', SUN, 'A')).toMatchObject({ morning: true, evening: true });
    await bulkMarkSimpleAttendance(SUN, 'A', [{ ...nimal }], 'sup1');
    expect(await stateAt('W1', SUN, 'A')).toMatchObject({ morning: false, evening: false });
  });

  it('driver shifts persist through present → absent → present', async () => {
    const d = { workerId: 'D1', workerName: 'Nuwan', morningPresent: true, eveningPresent: true, morningOtHours: 1, eveningOtHours: 0 };
    const read = async () => normalizeAttendance(await getSimpleAttendance(MON)).shifts.filter((s) => s.kind === 'driver').map((s) => s.shift).sort();
    await bulkMarkDriverAttendance(MON, [d], 'sup1');
    expect(await read()).toEqual(['evening', 'morning']);
    await bulkMarkDriverAttendance(MON, [{ ...d, morningPresent: false, eveningPresent: false, morningOtHours: 0 }], 'sup1');
    expect(await read()).toEqual([]);
    await bulkMarkDriverAttendance(MON, [{ ...d, eveningPresent: false }], 'sup1');
    expect(await read()).toEqual(['morning']);
    expect(store.size).toBe(1);
  });

  it('absent workers with no record do not create empty documents', async () => {
    await bulkMarkSimpleAttendance(MON, 'A', [{ ...nimal }, { ...kanchana }], 'sup1');
    expect(store.size).toBe(0);
  });

  it('saved docs carry audit fields', async () => {
    await bulkMarkSimpleAttendance(MON, 'A', [{ ...nimal, morning: true }], 'sup1');
    const d = store.get(`simpleAttendance/${siteAttendanceDocId('W1', MON)}`) as SimpleAttendance & Data;
    expect(d).toMatchObject({ updatedBy: 'sup1', createdBy: 'sup1', date: MON, workerId: 'W1' });
    expect(d.updatedAt).toBeInstanceOf(Date);
  });
});
