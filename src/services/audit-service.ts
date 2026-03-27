/**
 * =====================================================
 * AUDIT LOG SERVICE
 * =====================================================
 * Creates audit log entries for tracking system activity.
 */

import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { COLLECTIONS } from '@/constants';
import type { AuditAction, AuditLog, UserRole } from '@/types';

export interface CreateAuditLogParams {
  userId: string;
  userName: string;
  userRole: UserRole;
  action: AuditAction;
  resource: string;
  resourceId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    await addDoc(collection(db, COLLECTIONS.AUDIT_LOGS), {
      ...params,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    // Don't throw — audit logging should never break the main operation
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Fetch recent audit logs (simple query, no compound indexes needed)
 */
export async function getAuditLogs(maxResults = 200): Promise<AuditLog[]> {
  const q = query(
    collection(db, COLLECTIONS.AUDIT_LOGS),
    orderBy('timestamp', 'desc'),
    limit(maxResults)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      // Convert Firestore Timestamp to Date
      timestamp: data.timestamp?.toDate?.() ?? new Date(),
    } as AuditLog;
  });
}
