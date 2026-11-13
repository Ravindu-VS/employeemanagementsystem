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

describe('leave, notifications, transport', () => {
  it('employees request their own leave; only admins decide; employees may cancel pending', async () => {
    const leave = { employeeId: 'helper', type: 'annual', startDate: '2026-11-09', endDate: '2026-11-09', days: 1, status: 'pending' };
    await assertSucceeds(setDoc(doc(as('helper'), 'leaves/l1'), leave));
    await assertFails(setDoc(doc(as('helper'), 'leaves/l2'), { ...leave, employeeId: 'driver' }));
    await assertFails(setDoc(doc(as('helper'), 'leaves/l3'), { ...leave, status: 'approved' }));
    await assertFails(updateDoc(doc(as('helper'), 'leaves/l1'), { status: 'approved' }));
    await assertFails(updateDoc(doc(as('sup'), 'leaves/l1'), { status: 'approved' }));
    await assertSucceeds(updateDoc(doc(as('helper'), 'leaves/l1'), { status: 'cancelled' }));
    await assertFails(getDoc(doc(as('driver'), 'leaves/l1')));
  });
  it('notifications: own or role-addressed only; can only mark read', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore(); // get the admin instance once per context
      await setDoc(doc(db, 'notifications/n1'), { userId: 'helper', title: 't', isRead: false });
      await setDoc(doc(db, 'notifications/n2'), { userId: 'role:manager', title: 't', isRead: false });
    });
    await assertSucceeds(getDoc(doc(as('helper'), 'notifications/n1')));
    await assertFails(getDoc(doc(as('driver'), 'notifications/n1')));
    await assertSucceeds(getDoc(doc(as('manager'), 'notifications/n2')));
    await assertFails(getDoc(doc(as('helper'), 'notifications/n2')));
    await assertFails(updateDoc(doc(as('helper'), 'notifications/n1'), { title: 'x' }));
    await assertSucceeds(updateDoc(doc(as('helper'), 'notifications/n1'), { isRead: true }));
    await assertSucceeds(setDoc(doc(as('helper'), 'notifications/n3'), { userId: 'role:manager', title: 'Leave request', isRead: false }));
    await assertFails(setDoc(doc(as('pending'), 'notifications/n4'), { userId: 'role:owner', title: 'x', isRead: false }));
  });
  it('transport: everyone active reads, only payroll admins write', async () => {
    await assertFails(setDoc(doc(as('driver'), 'vehicles/v1'), { registrationNo: 'X' }));
    await assertSucceeds(setDoc(doc(as('manager'), 'vehicles/v1'), { registrationNo: 'X' }));
    await assertSucceeds(getDoc(doc(as('driver'), 'vehicles/v1')));
    await assertFails(setDoc(doc(as('sup'), 'transportRoutes/r1'), { name: 'R' }));
  });
});


describe('recruitment, assets, HR docs, monitoring, self-service', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'candidates/c1'), { jobId: 'j1', name: 'Nimal', stage: 'applied', matchScore: 40 });
      await setDoc(doc(db, 'assets/as1'), { assetTag: 'KK-1', status: 'assigned', assignedToEmployeeId: 'helper', history: [] });
      await setDoc(doc(db, 'assets/as2'), { assetTag: 'KK-2', status: 'available', assignedToEmployeeId: null, history: [] });
      await setDoc(doc(db, 'hrDocuments/pub'), { title: 'Leave policy', audience: 'all', content: 'x' });
      await setDoc(doc(db, 'hrDocuments/priv'), { title: 'Pay bands', audience: 'admins', content: 'y' });
      await setDoc(doc(db, 'simpleAttendance/HELPER_2026-11-02'), { workerId: 'HELPER', date: '2026-11-02' });
      await setDoc(doc(db, 'simpleAttendance/DRIVER_2026-11-02'), { workerId: 'DRIVER', date: '2026-11-02' });
    });
  });
  it('candidates: never created pre-rejected, rejection needs a person and a reason', async () => {
    await assertFails(setDoc(doc(as('manager'), 'candidates/c2'), { jobId: 'j1', name: 'X', stage: 'rejected' }));
    await assertSucceeds(setDoc(doc(as('manager'), 'candidates/c2'), { jobId: 'j1', name: 'X', stage: 'applied' }));
    await assertFails(updateDoc(doc(as('manager'), 'candidates/c1'), { stage: 'rejected', stageChangedBy: 'manager' }));
    await assertFails(updateDoc(doc(as('manager'), 'candidates/c1'), { stage: 'screening', stageChangedBy: 'someoneElse' }));
    await assertSucceeds(updateDoc(doc(as('manager'), 'candidates/c1'), { stage: 'rejected', stageChangedBy: 'manager', rejectionReason: 'No masonry experience' }));
    await assertFails(getDoc(doc(as('helper'), 'candidates/c1')));
  });
  it('assets: staff see only what they hold; nobody deletes', async () => {
    await assertSucceeds(getDoc(doc(as('helper'), 'assets/as1')));
    await assertFails(getDoc(doc(as('helper'), 'assets/as2')));
    await assertFails(updateDoc(doc(as('helper'), 'assets/as1'), { status: 'available' }));
    await assertSucceeds(updateDoc(doc(as('manager'), 'assets/as2'), { status: 'maintenance' }));
    await assertFails(deleteDoc(doc(as('owner'), 'assets/as2')));
  });
  it('HR documents: audience respected, only admins edit', async () => {
    await assertSucceeds(getDoc(doc(as('helper'), 'hrDocuments/pub')));
    await assertFails(getDoc(doc(as('helper'), 'hrDocuments/priv')));
    await assertSucceeds(getDoc(doc(as('manager'), 'hrDocuments/priv')));
    await assertFails(setDoc(doc(as('manager'), 'hrDocuments/new'), { title: 't', audience: 'all', content: 'c' }));
    await assertSucceeds(setDoc(doc(as('ceo'), 'hrDocuments/new'), { title: 't', audience: 'all', content: 'c' }));
  });
  it('client errors: anyone signed in can report as themselves, only admins read', async () => {
    await assertSucceeds(setDoc(doc(as('helper'), 'clientErrors/e1'), { message: 'boom', userId: 'helper', url: '/x' }));
    await assertFails(setDoc(doc(as('helper'), 'clientErrors/e2'), { message: 'boom', userId: 'owner', url: '/x' }));
    await assertFails(setDoc(doc(as('helper'), 'clientErrors/e3'), { message: 'x'.repeat(5000), url: '/x' }));
    await assertFails(getDoc(doc(as('helper'), 'clientErrors/e1')));
    await assertSucceeds(getDoc(doc(as('owner'), 'clientErrors/e1')));
  });
  it('self-service: own attendance only', async () => {
    await assertSucceeds(getDoc(doc(as('helper'), 'simpleAttendance/HELPER_2026-11-02')));
    await assertFails(getDoc(doc(as('helper'), 'simpleAttendance/DRIVER_2026-11-02')));
  });
});
