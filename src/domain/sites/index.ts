/**
 * =====================================================
 * SITE STATUS RULES
 * =====================================================
 * Active   → selectable for new attendance
 * Planning / On hold → selectable (work can start / resume)
 * Completed → visible read-only (attendance cannot change)
 * Inactive / Archived / Cancelled → never offered for new attendance.
 * Status changes never delete history: attendance and payroll keep the
 * siteId and the site document stays (sites are archived, not deleted).
 */

import type { SiteStatus, WorkSite } from '@/types';

const SELECTABLE: SiteStatus[] = ['active', 'planning', 'on_hold', 'completed'];
const READ_ONLY: SiteStatus[] = ['completed'];

export function isSiteSelectableForAttendance(site: Pick<WorkSite, 'status'> & { isActive?: boolean }): boolean {
  if (site.isActive === false && site.status !== 'completed') return false;
  return SELECTABLE.includes((site.status || 'active') as SiteStatus);
}

export function isSiteReadOnlyForAttendance(site: Pick<WorkSite, 'status'>): boolean {
  return READ_ONLY.includes(site.status as SiteStatus);
}

export function isSiteActive(site: Pick<WorkSite, 'status'> & { isActive?: boolean }): boolean {
  return isSiteSelectableForAttendance(site) && !isSiteReadOnlyForAttendance(site);
}
