/**
 * =====================================================
 * SITE SERVICE
 * =====================================================
 * Data operations for work site management.
 */

import {
  getDocument,
  getDocuments,
  getPaginatedDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  query,
  where,
  orderBy,
} from '@/lib/firebase/firestore';
import { COLLECTIONS } from '@/constants';
import type { 
  WorkSite, 
  SiteStatus, 
  GeoPoint,
  PaginatedResponse, 
  PaginationParams,
} from '@/types';

/**
 * Get a single site by ID
 */
export async function getSite(siteId: string): Promise<WorkSite | null> {
  return getDocument<WorkSite>(COLLECTIONS.SITES, siteId);
}

/**
 * Get all sites
 */
export async function getAllSites(): Promise<WorkSite[]> {
  return getDocuments<WorkSite>(COLLECTIONS.SITES, [
    orderBy('name', 'asc'),
  ]);
}

/**
 * Get active sites only
 */
export async function getActiveSites(): Promise<WorkSite[]> {
  return getDocuments<WorkSite>(COLLECTIONS.SITES, [
    where('status', '==', 'active'),
    orderBy('name', 'asc'),
  ]);
}

/**
 * Get sites with pagination
 */
export async function getSites(
  params: PaginationParams,
  filters?: {
    status?: SiteStatus;
    managerId?: string;
    supervisorId?: string;
  }
): Promise<PaginatedResponse<WorkSite>> {
  const constraints = [];

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }
  
  if (filters?.managerId) {
    constraints.push(where('managerId', '==', filters.managerId));
  }
  
  if (filters?.supervisorId) {
    constraints.push(where('supervisorIds', 'array-contains', filters.supervisorId));
  }

  return getPaginatedDocuments<WorkSite>(
    COLLECTIONS.SITES,
    params,
    constraints
  );
}

/**
 * Get sites by status
 */
export async function getSitesByStatus(status: SiteStatus): Promise<WorkSite[]> {
  return getDocuments<WorkSite>(COLLECTIONS.SITES, [
    where('status', '==', status),
    orderBy('name', 'asc'),
  ]);
}

/**
 * Get sites managed by a supervisor
 */
export async function getSitesBySupervisor(supervisorId: string): Promise<WorkSite[]> {
  return getDocuments<WorkSite>(COLLECTIONS.SITES, [
    where('supervisorIds', 'array-contains', supervisorId),
    where('status', '==', 'active'),
    orderBy('name', 'asc'),
  ]);
}

/**
 * Create a new site
 */
export async function createSite(
  data: Omit<WorkSite, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  return createDocument<WorkSite>(COLLECTIONS.SITES, data as any);
}

/**
 * Update a site
 */
export async function updateSite(
  siteId: string,
  data: Partial<WorkSite>
): Promise<void> {
  await updateDocument<WorkSite>(COLLECTIONS.SITES, siteId, data);
}

/**
 * Update site status
 */
export async function updateSiteStatus(
  siteId: string,
  status: SiteStatus
): Promise<void> {
  const updates: Partial<WorkSite> = { status };
  
  // Set completion date if marking as completed
  if (status === 'completed') {
    updates.actualEndDate = new Date();
  }
  
  await updateDocument<WorkSite>(COLLECTIONS.SITES, siteId, updates);
}

/**
 * Delete a site
 */
export async function deleteSite(siteId: string): Promise<void> {
  await deleteDocument(COLLECTIONS.SITES, siteId);
}

/**
 * Update site location
 */
export async function updateSiteLocation(
  siteId: string,
  location: GeoPoint,
  geofenceRadius?: number
): Promise<void> {
  const updates: Partial<WorkSite> = { location };
  
  if (geofenceRadius !== undefined) {
    updates.geofenceRadius = geofenceRadius;
  }
  
  await updateDocument<WorkSite>(COLLECTIONS.SITES, siteId, updates);
}

/**
 * Assign supervisors to a site
 */
export async function assignSupervisorsToSite(
  siteId: string,
  supervisorIds: string[]
): Promise<void> {
  await updateDocument<WorkSite>(COLLECTIONS.SITES, siteId, {
    supervisorIds,
  });
}

/**
 * Add supervisor to a site
 */
export async function addSupervisorToSite(
  siteId: string,
  supervisorId: string
): Promise<void> {
  const site = await getSite(siteId);
  
  if (!site) {
    throw new Error('Site not found');
  }
  
  const supervisorIds = [...(site.supervisorIds || [])];
  
  if (!supervisorIds.includes(supervisorId)) {
    supervisorIds.push(supervisorId);
    await updateDocument<WorkSite>(COLLECTIONS.SITES, siteId, { supervisorIds });
  }
}

/**
 * Remove supervisor from a site
 */
export async function removeSupervisorFromSite(
  siteId: string,
  supervisorId: string
): Promise<void> {
  const site = await getSite(siteId);
  
  if (!site) {
    throw new Error('Site not found');
  }
  
  const supervisorIds = (site.supervisorIds || []).filter(
    (id) => id !== supervisorId
  );
  
  await updateDocument<WorkSite>(COLLECTIONS.SITES, siteId, { supervisorIds });
}

/**
 * Get site count by status
 */
export async function getSiteCountByStatus(): Promise<Record<SiteStatus, number>> {
  const sites = await getAllSites();
  
  const counts: Record<string, number> = {
    planning: 0,
    active: 0,
    on_hold: 0,
    completed: 0,
    cancelled: 0,
  };
  
  sites.forEach((site) => {
    counts[site.status] = (counts[site.status] || 0) + 1;
  });
  
  return counts as Record<SiteStatus, number>;
}

/**
 * Check if location is within site geofence
 */
export function isWithinGeofence(
  site: WorkSite,
  location: GeoPoint
): boolean {
  const distance = calculateDistance(
    site.location.latitude,
    site.location.longitude,
    location.latitude,
    location.longitude
  );
  
  return distance <= site.geofenceRadius;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Generate unique site code
 */
export async function generateSiteCode(): Promise<string> {
  const sites = await getAllSites();
  const existingCodes = sites.map((s) => s.code);
  
  let counter = sites.length + 1;
  let code = `SITE-${String(counter).padStart(3, '0')}`;
  
  while (existingCodes.includes(code)) {
    counter++;
    code = `SITE-${String(counter).padStart(3, '0')}`;
  }
  
  return code;
}
