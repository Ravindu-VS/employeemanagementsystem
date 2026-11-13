/**
 * =====================================================
 * ORGANISATION CHART
 * =====================================================
 * Tree built from roles, with overrides:
 *   Owner → CEO → Manager → Supervisor → site staff (Draughtsman/Bass/Helper)
 *   Drivers report to a Manager.
 * - the Owner is always a root;
 * - employee.reportsTo (uid) wins when it points to an active employee and
 *   does not create a cycle;
 * - otherwise site staff go under the supervisor of their first assigned site;
 * - otherwise under the first person of the next role up.
 */

import type { UserProfile, UserRole, WorkSite } from '@/types';

export interface OrgNode {
  uid: string;
  name: string;
  role: UserRole;
  children: OrgNode[];
}

const PARENT_ROLE: Record<UserRole, UserRole[]> = {
  owner: [],
  ceo: ['owner'],
  manager: ['ceo', 'owner'],
  supervisor: ['manager', 'ceo', 'owner'],
  draughtsman: ['supervisor', 'manager', 'ceo', 'owner'],
  bass: ['supervisor', 'manager', 'ceo', 'owner'],
  helper: ['supervisor', 'manager', 'ceo', 'owner'],
  driver: ['manager', 'ceo', 'owner'],
};
const ORDER: UserRole[] = ['owner', 'ceo', 'manager', 'supervisor', 'draughtsman', 'bass', 'helper', 'driver'];

export function buildOrgTree(employees: UserProfile[], sites: Pick<WorkSite, 'id' | 'supervisorIds'>[] = []): OrgNode[] {
  const active = employees.filter((e) => e.isActive !== false && e.role).sort((a, b) => ORDER.indexOf(a.role as UserRole) - ORDER.indexOf(b.role as UserRole) || (a.displayName || '').localeCompare(b.displayName || ''));
  const byUid = new Map(active.map((e) => [e.uid, e]));
  const parentOf = new Map<string, string | null>();

  const createsCycle = (child: string, parent: string) => {
    let cur: string | null | undefined = parent;
    for (let i = 0; cur && i < 100; i++) {
      if (cur === child) return true;
      cur = parentOf.get(cur);
    }
    return false;
  };

  for (const e of active) {
    const role = e.role as UserRole;
    let parent: string | null = null;
    if (role === 'owner') { parentOf.set(e.uid, null); continue; }
    if (e.reportsTo && byUid.has(e.reportsTo) && e.reportsTo !== e.uid && !createsCycle(e.uid, e.reportsTo)) {
      parent = e.reportsTo;
    } else if (['draughtsman', 'bass', 'helper'].includes(role)) {
      const sup = (e.assignedSites || []).map((sid) => sites.find((s) => s.id === sid)?.supervisorIds || []).flat().find((uid) => uid && byUid.has(uid));
      if (sup) parent = sup;
    }
    if (!parent) {
      for (const r of PARENT_ROLE[role] || []) {
        const p = active.find((x) => x.role === r && x.uid !== e.uid && !createsCycle(e.uid, x.uid));
        if (p) { parent = p.uid; break; }
      }
    }
    parentOf.set(e.uid, parent);
  }

  const nodes = new Map<string, OrgNode>(active.map((e) => [e.uid, { uid: e.uid, name: e.displayName || e.email, role: e.role as UserRole, children: [] }]));
  const roots: OrgNode[] = [];
  for (const e of active) {
    const p = parentOf.get(e.uid);
    if (p && nodes.has(p)) nodes.get(p)!.children.push(nodes.get(e.uid)!);
    else roots.push(nodes.get(e.uid)!);
  }
  return roots;
}

export function countNodes(nodes: OrgNode[]): number {
  return nodes.reduce((n, x) => n + 1 + countNodes(x.children), 0);
}
