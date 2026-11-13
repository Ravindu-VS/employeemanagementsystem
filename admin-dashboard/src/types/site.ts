/**
 * =====================================================
 * WORK SITE TYPES
 * =====================================================
 */

/**
 * Work site / construction site model
 */
export interface WorkSite {
  id: string;
  name: string;
  code: string; // Unique short code (e.g., "SITE-001")
  address: string;
  city: string;
  state: string;
  pincode: string;
  location: GeoPoint;
  geofenceRadius: number; // in meters
  isActive: boolean;
  supervisorIds: string[];
  managerId?: string;
  startDate: Date;
  expectedEndDate?: Date;
  actualEndDate?: Date;
  clientName?: string;
  clientContact?: string;
  projectType: string;
  status: SiteStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export type SiteStatus = 
  | 'planning'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'cancelled'
  | 'inactive'
  | 'archived';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}
