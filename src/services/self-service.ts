/**
 * =====================================================
 * EMPLOYEE SELF-SERVICE (data access for "My Portal")
 * =====================================================
 * Every query is restricted to the signed-in employee's own records, which
 * is what firestore.rules allows for non-admin roles.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COLLECTIONS, ROUTES } from '@/constants';
import { normalizeAttendance, type NormalizedAttendance } from '@/domain/attendance';
import { createAdvanceRequest, getEmployeeAdvances } from './advance-service';
import { getEmployeeLoans } from './loan-service';
import { getEmployeePayrollHistory } from './payroll-service';
import { notifyRoles } from './notification-service';
import type { SimpleAttendance, UserProfile } from '@/types';

/** Own attendance in a date range (one equality query per id → provable by rules). */
export async function getMyAttendance(me: Pick<UserProfile, 'uid' | 'workerId'>, start: string, end: string): Promise<NormalizedAttendance> {
  const ids = Array.from(new Set([me.uid, me.workerId].filter(Boolean))) as string[];
  const snaps = await Promise.all(ids.map((id) => getDocs(query(collection(db, COLLECTIONS.SIMPLE_ATTENDANCE), where('workerId', '==', id)))));
  const records = snaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }) as SimpleAttendance));
  return normalizeAttendance(records, { start, end });
}

export const getMyPayslips = (uid: string) => getEmployeePayrollHistory(uid, 26);
export const getMyAdvances = (uid: string) => getEmployeeAdvances(uid);
export const getMyLoans = (uid: string) => getEmployeeLoans(uid);

/** Employee asks for an advance (pending until a payroll admin approves). */
export async function requestMyAdvance(me: Pick<UserProfile, 'uid' | 'displayName' | 'email'>, amount: number, reason: string, date: string): Promise<string> {
  const id = await createAdvanceRequest({ employeeId: me.uid, employeeName: me.displayName || me.email, amount, reason, requestedAt: date });
  await notifyRoles(['owner', 'ceo', 'manager'], {
    title: 'Advance request',
    message: `${me.displayName || me.email} requested an advance of LKR ${amount}`,
    type: 'advance',
    actionUrl: ROUTES.ADVANCES.LIST,
  });
  return id;
}
