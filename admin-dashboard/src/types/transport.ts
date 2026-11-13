/**
 * =====================================================
 * TRANSPORT TYPES (vehicles & routes)
 * =====================================================
 * The allowance paid to employees who travel on their own is configured per
 * employee (Employees → Transport) and in Settings → distance bands; it is
 * calculated by domain/transport. Vehicles and routes record company
 * transport: which driver drives which vehicle, to which site, with whom.
 */

export type TransportStatus = 'active' | 'inactive';

export interface Vehicle {
  id: string;
  registrationNo: string;
  type: 'van' | 'bus' | 'lorry' | 'car' | 'three_wheeler' | 'other';
  capacity: number;
  driverId?: string;
  status: TransportStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransportRoute {
  id: string;
  name: string;
  vehicleId?: string;
  driverId?: string;
  siteId?: string;
  pickupPoints?: string;
  distanceKm: number;
  passengerIds: string[];
  status: TransportStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
