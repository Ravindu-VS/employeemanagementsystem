/**
 * Firestore security rules — role escalation & data protection.
 * Run: npm run test:rules  (needs Java + the Firestore emulator)
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

let env: RulesTestEnvironment;
const user = (role: string | null, extra: Record<string, unknown> = {}) => ({
  role, isActive: role !== null, approved: role !== null, status: role ? 'active' : 'pending', displayName: role || 'pending', email: '', ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'kk-sons-rules-test',
    firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8') },
  });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'system/bootstrap'), { ownerUid: 'owner' });
    for (const [uid, role] of [['owner', 'owner'], ['ceo', 'ceo'], ['manager', 'manager'], ['sup', 'supervisor'], ['helper', 'helper'], ['driver', 'driver']] as const) {
      await setDoc(doc(db, `users/${uid}`), user(role, { workerId: uid.toUpperCase(), dailyRate: 5000 }));
    }
    await setDoc(doc(db, 'users/pending'), user(null));
    await setDoc(doc(db, 'payroll/p1'), { employeeId: 'helper', netPay: 1000, status: 'approved' });
    await setDoc(doc(db, 'advances/a1'), { employeeId: 'helper', amount: 500, status: 'approved', isDeducted: true });
  });
});
const as = (uid: string) => env.authenticatedContext(uid).firestore();

describe('signup & role escalation', () => {
  it('new user can create only a pending, role-less profile', async () => {
    const db = as('newbie');
    await assertFails(setDoc(doc(db, 'users/newbie'), user('owner')));
    await assertFails(setDoc(doc(db, 'users/newbie'), user('manager')));
    await assertSucceeds(setDoc(doc(db, 'users/newbie'), user(null)));
  });
  it('cannot claim Owner once bootstrap exists', async () => {
    const db = as('newbie');
    const b = writeBatch(db);
    b.set(doc(db, 'users/newbie'), user('owner'));
    await assertFails(b.commit());
  });
  it('pending user cannot change own role/status', async () => {
    const db = as('pending');
    await assertFails(updateDoc(doc(db, 'users/pending'), { role: 'owner' }));
    await assertFails(updateDoc(doc(db, 'users/pending'), { isActive: true }));
    await assertSucceeds(updateDoc(doc(db, 'users/pending'), { phone: '+94770000000' }));
  });
  it('helper cannot raise own salary or role', async () => {
    const db = as('helper');
    await assertFails(updateDoc(doc(db, 'users/helper'), { dailyRate: 99999 }));
    await assertFails(updateDoc(doc(db, 'users/helper'), { role: 'supervisor' }));
  });
  it('manager cannot assign roles; CEO can, but not Owner/CEO', async () => {
    await assertFails(updateDoc(doc(as('manager'), 'users/helper'), { role: 'supervisor' }));
    await assertSucceeds(updateDoc(doc(as('ceo'), 'users/helper'), { role: 'supervisor' }));
    await assertFails(updateDoc(doc(as('ceo'), 'users/pending'), { role: 'ceo', isActive: true }));
    await assertSucceeds(updateDoc(doc(as('owner'), 'users/pending'), { role: 'ceo', isActive: true, approved: true, status: 'active' }));
  });
});

describe('attendance, payroll, advances', () => {
  it('only attendance markers write attendance, with updatedBy = self', async () => {
    const data = { date: '2026-11-02', workerId: 'HELPER', siteShifts: { A: { morning: true, evening: false } } };
    await assertFails(setDoc(doc(as('helper'), 'simpleAttendance/HELPER_2026-11-02'), { ...data, updatedBy: 'helper' }));
    await assertFails(setDoc(doc(as('sup'), 'simpleAttendance/HELPER_2026-11-02'), { ...data, updatedBy: 'someoneElse' }));
    await assertSucceeds(setDoc(doc(as('sup'), 'simpleAttendance/HELPER_2026-11-02'), { ...data, updatedBy: 'sup' }));
    await assertFails(deleteDoc(doc(as('owner'), 'simpleAttendance/HELPER_2026-11-02')));
  });
  it('stored payroll amounts are immutable; status can change', async () => {
    await assertFails(updateDoc(doc(as('manager'), 'payroll/p1'), { netPay: 999999 }));
    await assertSucceeds(updateDoc(doc(as('manager'), 'payroll/p1'), { status: 'paid' }));
    await assertFails(updateDoc(doc(as('sup'), 'payroll/p1'), { status: 'paid' }));
  });
  it('employees read only their own payroll', async () => {
    await assertSucceeds(getDoc(doc(as('helper'), 'payroll/p1')));
    await assertFails(getDoc(doc(as('driver'), 'payroll/p1')));
  });
  it('a deducted advance cannot be un-deducted or deleted; supervisors cannot approve', async () => {
    await assertFails(updateDoc(doc(as('manager'), 'advances/a1'), { isDeducted: false }));
    await assertFails(deleteDoc(doc(as('owner'), 'advances/a1')));
    await assertFails(updateDoc(doc(as('sup'), 'advances/a1'), { status: 'approved' }));
  });
  it('audit logs are append-only and only admins read them', async () => {
    await assertSucceeds(setDoc(doc(as('sup'), 'auditLogs/l1'), { userId: 'sup', action: 'update' }));
    await assertFails(setDoc(doc(as('sup'), 'auditLogs/l2'), { userId: 'owner', action: 'update' }));
    await assertFails(getDoc(doc(as('manager'), 'auditLogs/l1')));
    await assertFails(updateDoc(doc(as('owner'), 'auditLogs/l1'), { action: 'x' }));
  });
});
