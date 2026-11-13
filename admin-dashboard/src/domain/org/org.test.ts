import { describe, it, expect } from 'vitest';
import { buildOrgTree, countNodes } from './index';
import type { UserProfile } from '@/types';

const u = (uid: string, role: string, extra: Partial<UserProfile> = {}) => ({ uid, email: `${uid}@x`, displayName: uid, role, isActive: true, assignedSites: [], ...extra }) as unknown as UserProfile;

describe('org chart', () => {
  it('builds the role hierarchy with site supervisors', () => {
    const people = [
      u('owner', 'owner'), u('mgr', 'manager'), u('sup1', 'supervisor'), u('sup2', 'supervisor'),
      u('h1', 'helper', { assignedSites: ['s2'] }), u('b1', 'bass'), u('d1', 'driver'), u('ceo', 'ceo'),
    ];
    const roots = buildOrgTree(people, [{ id: 's2', supervisorIds: ['sup2'] }]);
    expect(roots.map((r) => r.uid)).toEqual(['owner']);
    const ceo = roots[0].children[0];
    expect(ceo.uid).toBe('ceo');
    const mgr = ceo.children[0];
    expect(mgr.children.map((c) => c.uid).sort()).toEqual(['d1', 'sup1', 'sup2']);
    const sup2 = mgr.children.find((c) => c.uid === 'sup2')!;
    expect(sup2.children.map((c) => c.uid)).toEqual(['h1']);
    const sup1 = mgr.children.find((c) => c.uid === 'sup1')!;
    expect(sup1.children.map((c) => c.uid)).toEqual(['b1']);
    expect(countNodes(roots)).toBe(8);
  });
  it('honours reportsTo, ignores cycles and inactive people', () => {
    const people = [
      u('owner', 'owner', { reportsTo: 'mgr' }), u('mgr', 'manager'), u('h1', 'helper', { reportsTo: 'owner' }),
      u('gone', 'helper', { isActive: false }),
    ];
    const roots = buildOrgTree(people);
    expect(countNodes(roots)).toBe(3);
    // owner→mgr is allowed (mgr not yet placed) but mgr→owner would be a cycle, so mgr falls back to no parent... every node appears once
    const all: string[] = [];
    const walk = (n: { uid: string; children: { uid: string; children: never[] }[] }[]) => n.forEach((x) => { all.push(x.uid); walk(x.children as never); });
    walk(roots as never);
    expect(all.sort()).toEqual(['h1', 'mgr', 'owner']);
  });
});
