/**
 * =====================================================
 * MAINTENANCE — monitoring + one-off legacy migration
 * =====================================================
 */

import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client';
import { COLLECTIONS } from '@/constants';
import { auditAction } from './audit-service';
import { getSimpleAttendanceForDateRange } from './attendance-service';
import { planLegacyMigration, type MigrationPlan } from '@/domain/attendance/migration';
import { todayISO } from '@/lib/date-utils';
import type { ClientErrorLog } from '@/types';

// ---------------- client error reporting ----------------

const recent = new Map<string, number>();
let sentThisSession = 0;
const MAX_PER_SESSION = 20;

/** Report a browser error. Deduplicated (60 s) and capped per session; never throws. */
export async function reportClientError(error: unknown, extra: { source?: string } = {}): Promise<void> {
  try {
    if (typeof window === 'undefined' || sentThisSession >= MAX_PER_SESSION) return;
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
    const message = `${extra.source ? `[${extra.source}] ` : ''}${err.message || 'Unknown error'}`.slice(0, 4000);
    const now = Date.now();
    if ((recent.get(message) || 0) > now - 60_000) return;
    recent.set(message, now);
    const uid = auth.currentUser?.uid;
    if (!uid) return; // rules need a signed-in user
    sentThisSession++;
    await addDoc(collection(db, COLLECTIONS.CLIENT_ERRORS), {
      message,
      ...(err.stack ? { stack: err.stack.slice(0, 4000) } : {}),
      url: window.location.pathname + window.location.search,
      userId: uid,
      userAgent: navigator.userAgent.slice(0, 300),
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION || 'dev',
      createdAt: serverTimestamp(),
    });
  } catch {
    /* monitoring must never break the app */
  }
}

let installed = false;
export function installGlobalErrorHandlers(): () => void {
  if (typeof window === 'undefined' || installed) return () => {};
  installed = true;
  const onError = (e: ErrorEvent) => void reportClientError(e.error || e.message, { source: 'window' });
  const onRejection = (e: PromiseRejectionEvent) => void reportClientError(e.reason, { source: 'promise' });
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    installed = false;
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

export async function getRecentClientErrors(max = 100): Promise<ClientErrorLog[]> {
  const snap = await getDocs(query(collection(db, COLLECTIONS.CLIENT_ERRORS), orderBy('createdAt', 'desc'), limit(max)));
  return snap.docs.map((d) => {
    const x = d.data();
    return { id: d.id, ...x, createdAt: x.createdAt?.toDate?.() ?? new Date() } as ClientErrorLog;
  });
}

// ---------------- health ----------------

export interface HealthCheck {
  name: string;
  ok: boolean | null; // null = not configured
  detail: string;
  ms?: number;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value?: T; error?: unknown }> {
  const t = performance.now();
  try {
    const value = await fn();
    return { ms: Math.round(performance.now() - t), value };
  } catch (error) {
    return { ms: Math.round(performance.now() - t), error };
  }
}

async function pingService(name: string, base?: string): Promise<HealthCheck> {
  if (!base) return { name, ok: null, detail: 'Not configured' };
  const r = await timed(async () => {
    const res = await fetch(`${base.replace(/\/$/, '')}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  });
  if (r.error) return { name, ok: false, detail: String(r.error instanceof Error ? r.error.message : r.error), ms: r.ms };
  const flags = Object.entries(r.value || {}).filter(([k]) => k !== 'status').map(([k, v]) => `${k}: ${v ? 'on' : 'off'}`).join(', ');
  return { name, ok: true, detail: flags || 'ok', ms: r.ms };
}

export async function runHealthChecks(): Promise<HealthCheck[]> {
  const fs = await timed(() => getDoc(doc(db, COLLECTIONS.SETTINGS, 'company')));
  return Promise.all([
    Promise.resolve<HealthCheck>({ name: 'Firestore', ok: !fs.error, detail: fs.error ? String(fs.error) : 'Read OK', ms: fs.ms }),
    Promise.resolve<HealthCheck>({ name: 'Signed in', ok: !!auth.currentUser, detail: auth.currentUser?.email || 'No user' }),
    pingService('AI service', process.env.NEXT_PUBLIC_AI_ENDPOINT),
    pingService('Notification service', process.env.NEXT_PUBLIC_NOTIFY_ENDPOINT),
  ]);
}

// ---------------- legacy attendance migration ----------------

export async function planAttendanceMigration(start = '2000-01-01', end = todayISO()): Promise<MigrationPlan> {
  return planLegacyMigration(await getSimpleAttendanceForDateRange(start, end));
}

/**
 * Writes the plan: deterministic docs are set (merge) and old docs flagged
 * superseded. Nothing is deleted. Safe to run twice (second run is a no-op).
 */
export async function runAttendanceMigration(plan: MigrationPlan, actorUid: string): Promise<{ written: number; superseded: number }> {
  let written = 0;
  let superseded = 0;
  const COL = COLLECTIONS.SIMPLE_ATTENDANCE;
  let batch = writeBatch(db);
  let ops = 0;
  const flush = async () => { if (ops) { await batch.commit(); batch = writeBatch(db); ops = 0; } };
  for (const item of plan.items) {
    if (ops + 1 + item.supersede.length > 450) await flush();
    batch.set(doc(db, COL, item.targetId), { ...item.data, updatedBy: actorUid, updatedAt: serverTimestamp(), migratedAt: serverTimestamp() }, { merge: true });
    ops++; written++;
    for (const id of item.supersede) {
      batch.update(doc(db, COL, id), { superseded: true, supersededBy: item.targetId, supersededAt: serverTimestamp(), updatedBy: actorUid });
      ops++; superseded++;
    }
  }
  await flush();
  await auditAction('update', 'simpleAttendance', 'legacy-migration', { newValue: { written, superseded, scanned: plan.documentsScanned } });
  return { written, superseded };
}
