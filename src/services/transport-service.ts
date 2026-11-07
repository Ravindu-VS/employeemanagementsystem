/**
 * =====================================================
 * TRANSPORT SERVICE (vehicles & routes)
 * =====================================================
 */

import { createDocument, getDocuments, updateDocument } from '@/lib/firebase/firestore';
import { COLLECTIONS } from '@/constants';
import { auditAction } from './audit-service';
import type { TransportRoute, Vehicle } from '@/types';

export async function getVehicles(): Promise<Vehicle[]> {
  const v = await getDocuments<Vehicle>(COLLECTIONS.VEHICLES);
  return v.sort((a, b) => a.registrationNo.localeCompare(b.registrationNo));
}

export async function saveVehicle(data: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>, id?: string): Promise<string> {
  if (!data.registrationNo.trim()) throw new Error('Registration number is required');
  if (id) {
    await updateDocument<Vehicle>(COLLECTIONS.VEHICLES, id, data);
    await auditAction('update', 'vehicles', id, { newValue: data as unknown as Record<string, unknown> });
    return id;
  }
  const newId = await createDocument<Vehicle>(COLLECTIONS.VEHICLES, data as Omit<Vehicle, 'id'>);
  await auditAction('create', 'vehicles', newId, { newValue: data as unknown as Record<string, unknown> });
  return newId;
}

export async function getTransportRoutes(): Promise<TransportRoute[]> {
  const r = await getDocuments<TransportRoute>(COLLECTIONS.TRANSPORT_ROUTES);
  return r.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveTransportRoute(data: Omit<TransportRoute, 'id' | 'createdAt' | 'updatedAt'>, id?: string, vehicleCapacity?: number): Promise<string> {
  if (!data.name.trim()) throw new Error('Route name is required');
  if (data.distanceKm < 0) throw new Error('Distance cannot be negative');
  if (vehicleCapacity && data.passengerIds.length > vehicleCapacity) {
    throw new Error(`${data.passengerIds.length} passengers exceed the vehicle capacity of ${vehicleCapacity}`);
  }
  if (id) {
    await updateDocument<TransportRoute>(COLLECTIONS.TRANSPORT_ROUTES, id, data);
    await auditAction('update', 'transportRoutes', id, { newValue: { name: data.name, passengers: data.passengerIds.length } });
    return id;
  }
  const newId = await createDocument<TransportRoute>(COLLECTIONS.TRANSPORT_ROUTES, data as Omit<TransportRoute, 'id'>);
  await auditAction('create', 'transportRoutes', newId, { newValue: { name: data.name, passengers: data.passengerIds.length } });
  return newId;
}
