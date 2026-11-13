import { describe, it, expect } from 'vitest';
import { planLegacyMigration } from './migration';
import { normalizeAttendance } from './index';
import type { SimpleAttendance } from '@/types';

let n = 0;
const rec = (p: Partial<SimpleAttendance> & { id?: string; workerId: string; date: string }) =>
  ({ id: p.id || `rand${++n}`, workerName: p.workerId, supervisorId: 's', attendanceType: 'site', createdAt: new Date(n * 1000), updatedAt: new Date(n * 1000), ...p }) as SimpleAttendance;

/** Apply a plan the way the service does: write targets, flag sources. */
function apply(records: SimpleAttendance[]) {
  const plan = planLegacyMigration(records);
  const byId = new Map(records.map((r) => [r.id, { ...r }]));
  for (const it of plan.items) {
    byId.set(it.targetId, { id: it.targetId, createdAt: new Date(0), updatedAt: new Date(10_000_000), ...(it.data as object) } as SimpleAttendance);
    for (const id of it.supersede) byId.set(id, { ...byId.get(id)!, superseded: true, supersededBy: it.targetId });
  }
  return { plan, after: Array.from(byId.values()) };
}
const strip = (x: ReturnType<typeof normalizeAttendance>) => ({
  shifts: x.shifts.map(({ workerId, date, kind, siteId, shift }) => `${workerId}|${date}|${kind}|${siteId}|${shift}`).sort(),
  ot: x.ot.map(({ workerId, date, kind, siteId, hours }) => `${workerId}|${date}|${kind}|${siteId}|${hours}`).sort(),
});

describe('legacy attendance migration', () => {
  const legacy = [
    // two random-ID docs for the same worker/day (morning A, evening B with OT)
    rec({ workerId: 'W1', date: '2026-10-05', morningSite: 'A' }),
    rec({ workerId: 'W1', date: '2026-10-05', eveningSite: 'B', otHours: 2 }),
    // legacy doc next to an existing deterministic one
    rec({ id: 'W2_2026-10-05', workerId: 'W2', date: '2026-10-05', siteShifts: { A: { morning: true, evening: false } } }),
    rec({ workerId: 'W2', date: '2026-10-05', siteShifts: { A: { morning: false, evening: true } } as never, siteOtHours: { A: 1 } }),
    // driver legacy
    rec({ workerId: 'D1', date: '2026-10-05', attendanceType: 'driver', morningPresent: true, eveningPresent: false, otHours: 1 }),
    // supervisor visits
    rec({ workerId: 'S1', date: '2026-10-05', siteVisits: [{ siteId: 'A', visited: true, visitedAt: 'x' }, { siteId: 'B', visited: true, visitedAt: 'x' }] }),
    // already clean
    rec({ id: 'W3_2026-10-05', workerId: 'W3', date: '2026-10-05', siteShifts: { A: { morning: true, evening: true } } }),
    // already superseded (ignored)
    rec({ workerId: 'W3', date: '2026-10-05', morningSite: 'Z', superseded: true }),
  ];

  it('plans one target per worker/day and never touches clean or superseded docs', () => {
    const plan = planLegacyMigration(legacy);
    expect(plan.items.map((i) => i.targetId)).toEqual(['D1_2026-10-05_driver', 'S1_2026-10-05', 'W1_2026-10-05', 'W2_2026-10-05']);
    expect(plan.alreadyClean).toBe(1);
    expect(plan.legacyDocuments).toBe(5);
    expect(plan.items.find((i) => i.workerId === 'W2')!.supersede).toHaveLength(1);
    expect(plan.items.flatMap((i) => i.supersede)).not.toContain('W2_2026-10-05');
  });

  it('pay-relevant attendance is identical before and after', () => {
    const { after } = apply(legacy);
    expect(strip(normalizeAttendance(after))).toEqual(strip(normalizeAttendance(legacy)));
  });

  it('is idempotent: a second run finds nothing to do', () => {
    const { after } = apply(legacy);
    expect(planLegacyMigration(after).items).toEqual([]);
  });

  it('merged W1 document carries both sites and OT on the evening site', () => {
    const w1 = planLegacyMigration(legacy).items.find((i) => i.workerId === 'W1')!.data;
    expect(w1.siteShifts).toEqual({ A: { morning: true, evening: false }, B: { morning: false, evening: true } });
    expect(w1.siteOtHours).toEqual({ B: 2 });
  });
});
