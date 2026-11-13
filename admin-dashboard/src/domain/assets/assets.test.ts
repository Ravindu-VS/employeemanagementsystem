import { describe, it, expect } from 'vitest';
import { applyAssetAction } from './index';

const base = { status: 'available' as const, history: [], assignedToEmployeeId: null, assignedSiteId: null };

describe('asset lifecycle', () => {
  it('assign → return keeps history', () => {
    const a = applyAssetAction(base, { type: 'assign', employeeId: 'e1', siteId: 's1' }, 'admin', '2026-11-13T10:00:00+05:30');
    expect(a.status).toBe('assigned');
    expect(a.assignedToEmployeeId).toBe('e1');
    const r = applyAssetAction(a, { type: 'return', note: 'ok' }, 'admin', '2026-11-14T10:00:00+05:30');
    expect(r.status).toBe('available');
    expect(r.assignedToEmployeeId).toBeNull();
    expect(r.history.map((h) => h.action)).toEqual(['assigned', 'returned']);
    expect(r.history[1].note).toBe('ok');
  });
  it('refuses invalid moves', () => {
    expect(() => applyAssetAction(base, { type: 'assign' }, 'a', 't')).toThrow(/employee or a site/);
    expect(() => applyAssetAction(base, { type: 'return' }, 'a', 't')).toThrow();
    const a = applyAssetAction(base, { type: 'assign', siteId: 's1' }, 'a', 't');
    expect(() => applyAssetAction(a, { type: 'assign', siteId: 's2' }, 'a', 't')).toThrow(/Only available/);
    expect(() => applyAssetAction(base, { type: 'available' }, 'a', 't')).toThrow();
  });
  it('maintenance and retire', () => {
    const m = applyAssetAction(base, { type: 'maintenance' }, 'a', 't');
    expect(m.status).toBe('maintenance');
    const back = applyAssetAction(m, { type: 'available' }, 'a', 't');
    expect(back.status).toBe('available');
    const ret = applyAssetAction(back, { type: 'retire' }, 'a', 't');
    expect(ret.status).toBe('retired');
    expect(() => applyAssetAction(ret, { type: 'maintenance' }, 'a', 't')).toThrow(/retired/);
  });
});
