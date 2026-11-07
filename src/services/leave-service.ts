/**
 * =====================================================
 * LEAVE SERVICE
 * =====================================================
 * Employee request → Manager/CEO/Owner approval → balance (computed from
 * approved requests) → notification. Rules: domain/leave.
 */

import { createDocument, getDocument, getDocuments, updateDocument, where } from '@/lib/firebase/firestore';
import { COLLECTIONS, ROUTES } from '@/constants';
import { countLeaveDays, DEFAULT_LEAVE_SETTINGS, validateLeaveRequest } from '@/domain/leave';
import { auditAction } from './audit-service';
import { notifyRoles, notifyUsers } from './notification-service';
import type { LeaveRequest, LeaveSettings, LeaveType } from '@/types';

export async function getAllLeaveRequests(): Promise<LeaveRequest[]> {
  const all = await getDocuments<LeaveRequest>(COLLECTIONS.LEAVES);
  return all.sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function getEmployeeLeaveRequests(employeeId: string): Promise<LeaveRequest[]> {
  const all = await getDocuments<LeaveRequest>(COLLECTIONS.LEAVES, [where('employeeId', '==', employeeId)]);
  return all.sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function getLeaveSettings(): Promise<LeaveSettings> {
  try {
    const s = await getDocument<LeaveSettings>(COLLECTIONS.SETTINGS, 'leave');
    return { ...DEFAULT_LEAVE_SETTINGS, ...(s || {}) };
  } catch {
    return DEFAULT_LEAVE_SETTINGS;
  }
}

export async function requestLeave(
  data: { employeeId: string; employeeName: string; type: LeaveType; startDate: string; endDate: string; reason: string },
  requestedBy: string
): Promise<string> {
  const [existing, settings] = await Promise.all([getEmployeeLeaveRequests(data.employeeId), getLeaveSettings()]);
  const error = validateLeaveRequest(data, existing, settings);
  if (error) throw new Error(error);
  const id = await createDocument<LeaveRequest>(COLLECTIONS.LEAVES, {
    ...data,
    days: countLeaveDays(data.startDate, data.endDate),
    status: 'pending',
    requestedBy,
  } as Omit<LeaveRequest, 'id'>);
  await auditAction('create', 'leaves', id, { newValue: { employeeId: data.employeeId, type: data.type, startDate: data.startDate, endDate: data.endDate } });
  await notifyRoles(['owner', 'ceo', 'manager'], {
    title: 'Leave request',
    message: `${data.employeeName} requested ${data.type} leave ${data.startDate} – ${data.endDate}`,
    type: 'announcement',
    actionUrl: ROUTES.LEAVE,
  });
  return id;
}

export async function decideLeave(id: string, decision: 'approved' | 'rejected', reviewerUid: string, notes?: string): Promise<void> {
  const leave = await getDocument<LeaveRequest>(COLLECTIONS.LEAVES, id);
  if (!leave) throw new Error('Leave request not found');
  if (leave.status !== 'pending') throw new Error('Only pending requests can be decided');
  if (decision === 'rejected' && !notes) throw new Error('A reason is required to reject');
  await updateDocument<LeaveRequest>(COLLECTIONS.LEAVES, id, {
    status: decision,
    reviewedBy: reviewerUid,
    reviewedAt: new Date(),
    ...(notes ? { reviewNotes: notes } : {}),
  });
  await auditAction(decision === 'approved' ? 'approve' : 'reject', 'leaves', id, { newValue: { status: decision, notes } });
  await notifyUsers([leave.employeeId], {
    title: `Leave ${decision}`,
    message: `Your ${leave.type} leave ${leave.startDate} – ${leave.endDate} was ${decision}${notes ? `: ${notes}` : ''}`,
    type: 'announcement',
    actionUrl: ROUTES.LEAVE,
  });
}

export async function cancelLeave(id: string): Promise<void> {
  const leave = await getDocument<LeaveRequest>(COLLECTIONS.LEAVES, id);
  if (!leave || leave.status !== 'pending') throw new Error('Only pending requests can be cancelled');
  await updateDocument<LeaveRequest>(COLLECTIONS.LEAVES, id, { status: 'cancelled' });
  await auditAction('update', 'leaves', id, { newValue: { status: 'cancelled' } });
}
