/**
 * =====================================================
 * ASSET SERVICE
 * =====================================================
 */

import { createDocument, getDocuments, updateDocument } from '@/lib/firebase/firestore';
import { COLLECTIONS } from '@/constants';
import { auditAction } from './audit-service';
import { applyAssetAction, type AssetAction } from '@/domain/assets';
import type { Asset } from '@/types';

export async function getAssets(): Promise<Asset[]> {
  const a = await getDocuments<Asset>(COLLECTIONS.ASSETS);
  return a.sort((x, y) => x.assetTag.localeCompare(y.assetTag));
}

export type NewAsset = Omit<Asset, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'history' | 'assignedToEmployeeId' | 'assignedSiteId'>;

export async function createAsset(data: NewAsset, by: string, existingTags: string[] = []): Promise<string> {
  if (!data.assetTag.trim() || !data.name.trim()) throw new Error('Asset tag and name are required');
  if (existingTags.map((t) => t.toLowerCase()).includes(data.assetTag.trim().toLowerCase())) throw new Error(`Asset tag ${data.assetTag} already exists`);
  if (data.purchaseCost !== undefined && data.purchaseCost < 0) throw new Error('Cost cannot be negative');
  const id = await createDocument<Asset>(COLLECTIONS.ASSETS, {
    ...data,
    assetTag: data.assetTag.trim(),
    status: 'available',
    assignedToEmployeeId: null,
    assignedSiteId: null,
    history: [{ at: new Date().toISOString(), by, action: 'created' }],
  } as Omit<Asset, 'id'>);
  await auditAction('create', 'assets', id, { newValue: { assetTag: data.assetTag, name: data.name } });
  return id;
}

export async function changeAsset(asset: Asset, action: AssetAction, by: string): Promise<void> {
  const next = applyAssetAction(asset, action, by, new Date().toISOString());
  await updateDocument<Asset>(COLLECTIONS.ASSETS, asset.id, next);
  await auditAction('update', 'assets', asset.id, { oldValue: { status: asset.status }, newValue: { status: next.status, action: action.type } });
}
