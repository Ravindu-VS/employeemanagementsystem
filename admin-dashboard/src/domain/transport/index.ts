/**
 * =====================================================
 * TRANSPORT ALLOWANCE RULES
 * =====================================================
 * Allowance = eligibility × configured rate. Nothing is hard-coded:
 *   per_day        rate × days worked
 *   per_km         distance × rate × days worked
 *   per_week       flat rate when the employee worked at least once
 *   per_site       rate × distinct sites worked
 *   distance_band  settings band(distance).ratePerDay × days worked
 * Employees using the company vehicle (or 'none') receive no allowance.
 */

import type { TransportBand, UserProfile } from '@/types';

export type TransportInput = Pick<UserProfile, 'transportType' | 'transportRate' | 'transportRateType' | 'distance'>;

export function isTransportEligible(e: TransportInput): boolean {
  return !!e.transportType && e.transportType !== 'none' && e.transportType !== 'company_vehicle';
}

export function findTransportBand(bands: TransportBand[] | undefined, distanceKm: number): TransportBand | undefined {
  return (bands || []).find((b) => distanceKm >= b.minKm && (b.maxKm === null || b.maxKm === undefined || distanceKm < b.maxKm));
}

export function calculateTransportAllowance(
  employee: TransportInput,
  worked: { days: number; distinctSites: number },
  bands?: TransportBand[]
): { amount: number; basis: string } {
  if (!isTransportEligible(employee) || worked.days <= 0) return { amount: 0, basis: '' };
  const rate = Number(employee.transportRate) || 0;
  const distance = Number(employee.distance) || 0;
  switch (employee.transportRateType || 'per_day') {
    case 'per_km':
      return { amount: distance * rate * worked.days, basis: `${distance} km × ${rate}/km × ${worked.days} days` };
    case 'per_week':
      return { amount: rate, basis: 'weekly flat rate' };
    case 'per_site':
      return { amount: rate * worked.distinctSites, basis: `${rate} × ${worked.distinctSites} sites` };
    case 'distance_band': {
      const band = findTransportBand(bands, distance);
      if (!band) return { amount: 0, basis: `no distance band configured for ${distance} km` };
      return {
        amount: band.ratePerDay * worked.days,
        basis: `${band.label || `${band.minKm}–${band.maxKm ?? '∞'} km`} × ${worked.days} days`,
      };
    }
    case 'per_day':
    default:
      return { amount: rate * worked.days, basis: `${rate}/day × ${worked.days} days` };
  }
}
