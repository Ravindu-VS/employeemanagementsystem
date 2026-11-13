/**
 * =====================================================
 * NOTIFICATION SERVICE (in-app)
 * =====================================================
 * Real, stored notifications (collection `notifications`), shown in the
 * header bell. Sent for: account approval, advance decisions, leave
 * requests/decisions, payroll approval and payment.
 */

import { collection, doc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COLLECTIONS } from '@/constants';
import { createLogger } from '@/lib/logger';
import type { Notification, NotificationType, UserRole } from '@/types';
import { notifyExternally } from './external-notify';

const log = createLogger('Notifications');

export interface NotificationInput {
  title: string;
  message: string;
  type: NotificationType;
  actionUrl?: string;
}

/** Notify specific users (uids). Never throws — notifications are best-effort. */
export async function notifyUsers(userIds: string[], n: NotificationInput): Promise<void> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return;
  try {
    for (let i = 0; i < ids.length; i += 400) {
      const batch = writeBatch(db);
      ids.slice(i, i + 400).forEach((userId) => {
        batch.set(doc(collection(db, COLLECTIONS.NOTIFICATIONS)), {
          userId,
          title: n.title,
          message: n.message,
          type: n.type,
          ...(n.actionUrl ? { actionUrl: n.actionUrl } : {}),
          isRead: false,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  } catch (e) {
    log.warn('Failed to send notification', { error: String(e) });
  }
  // Email / SMS (optional, only when the notification service is configured).
  void notifyExternally(ids, n);
}

/**
 * Notify everyone holding one of the roles. Stored once per role
 * (userId = "role:<role>") so any employee can notify managers without being
 * allowed to list user records.
 */
export async function notifyRoles(roles: UserRole[], n: NotificationInput): Promise<void> {
  await notifyUsers(roles.map((r) => `role:${r}`), n);
}

/** The signed-in user's latest notifications (no composite index needed). */
export async function getMyNotifications(uid: string, max = 20, role?: string | null): Promise<Notification[]> {
  // One equality query per target keeps every query provable by the rules.
  const targets = role ? [uid, `role:${role}`] : [uid];
  const snaps = await Promise.all(targets.map((t) => getDocs(query(collection(db, COLLECTIONS.NOTIFICATIONS), where('userId', '==', t)))));
  return snaps.flatMap((snap) => snap.docs)
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        title: data.title || 'Notification',
        message: data.message || '',
        type: (data.type || 'system') as NotificationType,
        isRead: data.isRead === true || data.read === true,
        actionUrl: data.actionUrl,
        createdAt: data.createdAt?.toDate?.() ?? new Date(),
      } as Notification;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, max);
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  ids.forEach((id) => batch.update(doc(db, COLLECTIONS.NOTIFICATIONS, id), { isRead: true, readAt: serverTimestamp() }));
  await batch.commit();
}
