/**
 * =====================================================
 * EXTERNAL NOTIFICATIONS (email / SMS)
 * =====================================================
 * Optional. When NEXT_PUBLIC_NOTIFY_ENDPOINT points at the notification
 * service, direct notifications are also sent by SMS (if the employee has a
 * phone and SMS is on) or email (if email is on). Best-effort: never throws.
 */

import { auth } from '@/lib/firebase/client';
import { getDocument } from '@/lib/firebase/firestore';
import { COLLECTIONS } from '@/constants';
import { createLogger } from '@/lib/logger';
import type { NotificationSettings, UserProfile } from '@/types';

const log = createLogger('ExternalNotify');

export interface ExternalMessage {
  channel: 'email' | 'sms';
  to: string;
  subject?: string;
  message: string;
}

export function pickChannels(user: Pick<UserProfile, 'phone' | 'email'>, settings: Pick<NotificationSettings, 'emailEnabled' | 'smsEnabled'>, n: { title: string; message: string }): ExternalMessage[] {
  const out: ExternalMessage[] = [];
  if (settings.smsEnabled && user.phone && user.phone.replace(/\D/g, '').length >= 9) {
    out.push({ channel: 'sms', to: user.phone, message: `KK & SONS: ${n.title}. ${n.message}`.slice(0, 480) });
  }
  if (settings.emailEnabled && user.email && /@/.test(user.email)) {
    out.push({ channel: 'email', to: user.email, subject: n.title, message: n.message });
  }
  return out;
}

export async function sendExternal(msg: ExternalMessage): Promise<'sent' | 'skipped' | 'failed'> {
  const endpoint = process.env.NEXT_PUBLIC_NOTIFY_ENDPOINT;
  if (!endpoint) return 'skipped';
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return 'skipped';
    const res = await fetch(`${endpoint.replace(/\/$/, '')}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(msg),
    });
    if (!res.ok) return 'failed';
    const j = await res.json();
    return j.status === 'sent' ? 'sent' : 'skipped';
  } catch (e) {
    log.warn('External notification failed', { error: String(e) });
    return 'failed';
  }
}

/** Fan out to the given users (uids only; role targets are in-app only). */
export async function notifyExternally(userIds: string[], n: { title: string; message: string }): Promise<void> {
  if (!process.env.NEXT_PUBLIC_NOTIFY_ENDPOINT) return;
  try {
    const settings = (await getDocument<NotificationSettings>(COLLECTIONS.SETTINGS, 'notifications')) || { emailEnabled: true, smsEnabled: false } as NotificationSettings;
    for (const uid of userIds.filter((u) => u && !u.startsWith('role:'))) {
      const user = await getDocument<UserProfile>(COLLECTIONS.USERS, uid).catch(() => null);
      if (!user) continue;
      for (const m of pickChannels(user, settings, n)) await sendExternal(m);
    }
  } catch (e) {
    log.warn('External notification fan-out failed', { error: String(e) });
  }
}
