/**
 * =====================================================
 * ASSET MANAGEMENT RULES
 * =====================================================
 * available → assigned (to an employee and/or a site) → returned → available
 * any → maintenance → available;  any → retired (final).
 * Every change appends to the asset's history.
 */

import type { Asset, AssetHistoryEntry } from '@/types';

export type AssetAction =
  | { type: 'assign'; employeeId?: string; siteId?: string; note?: string }
  | { type: 'return'; note?: string }
  | { type: 'maintenance'; note?: string }
  | { type: 'available'; note?: string }
  | { type: 'retire'; note?: string };

export function applyAssetAction(asset: Pick<Asset, 'status' | 'history' | 'assignedToEmployeeId' | 'assignedSiteId'>, action: AssetAction, by: string, at: string): Pick<Asset, 'status' | 'history' | 'assignedToEmployeeId' | 'assignedSiteId'> {
  if (asset.status === 'retired') throw new Error('A retired asset cannot be changed');
  const entry = (a: AssetHistoryEntry['action'], extra: Partial<AssetHistoryEntry> = {}): AssetHistoryEntry => ({ at, by, action: a, ...extra, ...(action.note ? { note: action.note } : {}) });
  switch (action.type) {
    case 'assign':
      if (asset.status !== 'available') throw new Error(`Only available assets can be assigned (this one is ${asset.status})`);
      if (!action.employeeId && !action.siteId) throw new Error('Choose an employee or a site');
      return {
        status: 'assigned',
        assignedToEmployeeId: action.employeeId || null,
        assignedSiteId: action.siteId || null,
        history: [...asset.history, entry('assigned', { ...(action.employeeId ? { employeeId: action.employeeId } : {}), ...(action.siteId ? { siteId: action.siteId } : {}) })],
      };
    case 'return':
      if (asset.status !== 'assigned') throw new Error('Only assigned assets can be returned');
      return { status: 'available', assignedToEmployeeId: null, assignedSiteId: null, history: [...asset.history, entry('returned')] };
    case 'maintenance':
      return { status: 'maintenance', assignedToEmployeeId: null, assignedSiteId: null, history: [...asset.history, entry('maintenance')] };
    case 'available':
      if (asset.status !== 'maintenance') throw new Error('Only assets in maintenance can be marked available');
      return { ...asset, status: 'available', history: [...asset.history, entry('updated', { note: action.note || 'Back from maintenance' })] };
    case 'retire':
      return { status: 'retired', assignedToEmployeeId: null, assignedSiteId: null, history: [...asset.history, entry('retired')] };
  }
}
