/**
 * =====================================================
 * ADVANCE SERVICE - COMPLETE REBUILD
 * =====================================================
 *
 * BUSINESS RULES:
 * ✅ Rule 1: Only APPROVED advances are valid for payroll
 * ✅ Rule 2: Deduction is NOT automatic (CEO decides)
 * ✅ Rule 3: Carry forward system - if not deducted, appears next week
 * ✅ Rule 4: Deduct once only - mark as deducted after deduction
 * ✅ Rule 5: Week-based (Sunday-Saturday)
 *
 * KEY FIELDS:
 * - status: "pending" | "approved" | "rejected" (only approved show in payroll)
 * - deducted: false (eligible) | true (already deducted, hide)
 * - deductionWeek: week when deducted (for record keeping)
 *
 * NO MORE:
 * - deductThisWeek (CEO decides in UI, not stored)
 * - deductionWeekId (use deductionWeek instead)
 */

import {
  getDocument,
  getDocuments,
  getPaginatedDocuments,
  createDocument,
  updateDocument,
  query,
  where,
  orderBy,
} from '@/lib/firebase/firestore';
import { COLLECTIONS } from '@/constants';
import { toISODateString } from '@/lib/date-utils';
import { isAdvanceDeducted } from '@/domain/advances';
import { auditAction } from './audit-service';
import type {
  AdvanceRequest,
  RequestStatus,
  PaginatedResponse,
  PaginationParams,
} from '@/types';


// =====================================================
// CORE QUERIES
// =====================================================

/**
 * Get single advance by ID
 */
export async function getAdvance(advanceId: string): Promise<AdvanceRequest | null> {
  return getDocument<AdvanceRequest>(COLLECTIONS.ADVANCES, advanceId);
}

/**
 * 🔥 CRITICAL: Get ALL approved + un-deducted advances for payroll page
 * Used to display advances to CEO for deduction selection
 *
 * Business Rule: Only APPROVED advances shown to CEO
 * CEO decides in UI which to deduct this week
 *
 * ⚠️ FIRESTORE FIELD MIGRATION:
 * Old docs: isDeducted field (bool)
 * New docs: deducted field (bool)
 * Query both to handle mixed Firestore state
 */
export async function getAllPendingAdvances(): Promise<AdvanceRequest[]> {
  // Get all un-deducted advances (handles both old & new field names)
  const allAdvances = await getDocuments<AdvanceRequest>(COLLECTIONS.ADVANCES, [
    where('deducted', '==', false),
  ]);

  // Also fetch with old field name for backward compat
  const allAdvancesOld = await getDocuments<any>(COLLECTIONS.ADVANCES, [
    where('isDeducted', '==', false),
  ]);

  // Merge and deduplicate by ID
  const mergedMap = new Map<string, AdvanceRequest>();

  for (const adv of allAdvances) {
    if (adv.status === 'approved') {
      mergedMap.set(adv.id, adv);
    }
  }

  for (const adv of allAdvancesOld) {
    if (adv.status === 'approved' && !mergedMap.has(adv.id)) {
      // Map old field to new (for consistency in code)
      const normalized: AdvanceRequest = {
        ...adv,
        deducted: adv.isDeducted || adv.deducted || false,
        deductionWeek: adv.deductionWeek || adv.deductionWeekId || null,
      };
      mergedMap.set(adv.id, normalized);
    }
  }

  return Array.from(mergedMap.values());
}

/**
 * Get PENDING advances (awaiting approval)
 * Used by admin/approvals page
 */
/** Every advance document (admin advance page). */
export async function getAllAdvances(): Promise<AdvanceRequest[]> {
  return getDocuments<AdvanceRequest>(COLLECTIONS.ADVANCES);
}

export async function getPendingAdvances(): Promise<AdvanceRequest[]> {
  return getDocuments<AdvanceRequest>(COLLECTIONS.ADVANCES, [
    where('status', '==', 'pending'),
  ]);
}

/**
 * Get advances for single employee
 */
export async function getEmployeeAdvances(employeeId: string): Promise<AdvanceRequest[]> {
  const results = await getDocuments<AdvanceRequest>(COLLECTIONS.ADVANCES, [
    where('employeeId', '==', employeeId),
  ]);
  // Sort by date, newest first
  return results.sort((a, b) => {
    const aTime = a.requestedAt instanceof Date ? a.requestedAt.getTime() : 0;
    const bTime = b.requestedAt instanceof Date ? b.requestedAt.getTime() : 0;
    return bTime - aTime;
  });
}

/**
 * Get paginated advances (admin page)
 */
export async function getAdvancesPaginated(
  params: PaginationParams,
  filters?: {
    employeeId?: string;
    status?: RequestStatus;
  }
): Promise<PaginatedResponse<AdvanceRequest>> {
  const constraints = [];

  if (filters?.employeeId) {
    constraints.push(where('employeeId', '==', filters.employeeId));
  }

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  return getPaginatedDocuments<AdvanceRequest>(
    COLLECTIONS.ADVANCES,
    params,
    constraints
  );
}

// =====================================================
// CREATE & UPDATE
// =====================================================

/**
 * Create new advance request
 *
 * Status: "pending" (awaiting manager approval)
 * isDeducted: false (not yet deducted)
 *
 * NO deductThisWeek or deductionWeek - those are decided by CEO during payroll
 */
export async function createAdvanceRequest(
  data: {
    employeeId: string;
    employeeName: string;
    amount: number;
    reason: string;
    requestedAt?: string; // ISO date string e.g. '2026-03-12'
  }
): Promise<string> {
  // Validate amount
  if (data.amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  // Check for existing pending requests
  const pendingRequests = await getDocuments<AdvanceRequest>(COLLECTIONS.ADVANCES, [
    where('employeeId', '==', data.employeeId),
    where('status', '==', 'pending'),
  ]);

  if (pendingRequests.length > 0) {
    throw new Error('There is already a pending advance request for this employee');
  }

  const advanceData: Omit<AdvanceRequest, 'id' | 'createdAt' | 'updatedAt'> = {
    employeeId: data.employeeId,
    employeeName: data.employeeName,
    amount: data.amount,
    reason: data.reason,
    // Advance date: Colombo calendar date anchored at noon (timezone-safe)
    requestedAt: data.requestedAt
      ? new Date(data.requestedAt + 'T12:00:00+05:30')
      : new Date(),
    advanceDate: data.requestedAt || toISODateString(new Date()),
    status: 'pending',
    deductThisWeek: true,
    isDeducted: false,
    deducted: false,
    carryForward: false,
  } as Omit<AdvanceRequest, 'id' | 'createdAt' | 'updatedAt'>;

  const id = await createDocument<AdvanceRequest>(COLLECTIONS.ADVANCES, advanceData as any);
  await auditAction('create', 'advances', id, { newValue: { employeeId: data.employeeId, amount: data.amount, date: advanceData.advanceDate } });
  return id;
}

/**
 * Approve advance request
 * Changes status from "pending" → "approved"
 * Now eligible for deduction during payroll
 */
export async function approveAdvance(
  advanceId: string,
  reviewedBy: string,
  notes?: string
): Promise<void> {
  const advance = await getAdvance(advanceId);

  if (!advance) {
    throw new Error('Advance request not found');
  }

  if (advance.status !== 'pending') {
    throw new Error('Advance request is not pending');
  }

  const updateData: any = {
    status: 'approved',
    reviewedBy,
    reviewedAt: new Date(),
  };

  // Only include reviewNotes if provided (avoid undefined in Firestore)
  if (notes) {
    updateData.reviewNotes = notes;
  }

  await updateDocument<AdvanceRequest>(COLLECTIONS.ADVANCES, advanceId, updateData);
  await auditAction('approve', 'advances', advanceId, { newValue: { employeeId: advance.employeeId, amount: advance.amount, status: 'approved' } });
}

/**
 * Reject advance request
 * Changes status from "pending" → "rejected"
 * Never shown again
 */
export async function rejectAdvance(
  advanceId: string,
  reviewedBy: string,
  notes: string
): Promise<void> {
  const advance = await getAdvance(advanceId);

  if (!advance) {
    throw new Error('Advance request not found');
  }

  if (advance.status !== 'pending') {
    throw new Error('Advance request is not pending');
  }

  if (!notes) {
    throw new Error('Rejection reason is required');
  }

  await updateDocument<AdvanceRequest>(COLLECTIONS.ADVANCES, advanceId, {
    status: 'rejected',
    reviewedBy,
    reviewedAt: new Date(),
    reviewNotes: notes,
  });
  await auditAction('reject', 'advances', advanceId, { newValue: { employeeId: advance.employeeId, amount: advance.amount, reason: notes } });
}

/**
 * Cancel advance request (by employee)
 * Only pending requests can be cancelled
 */
export async function cancelAdvance(advanceId: string): Promise<void> {
  const advance = await getAdvance(advanceId);

  if (!advance) {
    throw new Error('Advance request not found');
  }

  if (advance.status !== 'pending') {
    throw new Error('Only pending requests can be cancelled');
  }

  await updateDocument<AdvanceRequest>(COLLECTIONS.ADVANCES, advanceId, {
    status: 'cancelled',
  });
}

// =====================================================
// PAYROLL INTEGRATION
// =====================================================

/**
 * 🔥 CRITICAL: Mark advances as deducted after payroll approval
 *
 * Called by generateEmployeePayroll() when payroll is created
 * Sets:
 *   - deducted: true (hide from next week's payroll)
 *   - deductionWeek: the week it was deducted (for audit trail)
 *
 * ⚠️ Handles both old (isDeducted) and new (deducted) field migration
 */
export async function markAdvanceDeducted(
  advanceId: string,
  weekStartDate: string // ISO date e.g. "2026-03-23"
): Promise<void> {
  const advance = await getAdvance(advanceId);

  if (!advance) {
    throw new Error('Advance not found');
  }

  // Check if already deducted (handle both field names)
  const isDed = isAdvanceDeducted(advance);
  if (isDed) {
    // Already deducted - no-op
    return;
  }

  // Update to new field names
  await updateDocument<AdvanceRequest>(COLLECTIONS.ADVANCES, advanceId, {
    isDeducted: true,
    deducted: true, // both legacy flags, so no query ever re-offers it
    deductionWeekId: weekStartDate,
    deductedWeek: weekStartDate,
    carryForward: false,
    advanceState: 'fully_deducted',
  });
}

/**
 * Mark advance as carried forward (not deducted this week)
 */
export async function markAdvanceCarriedForward(
  advanceId: string
): Promise<void> {
  await updateDocument<AdvanceRequest>(COLLECTIONS.ADVANCES, advanceId, {
    carryForward: true,
    deductThisWeek: false,
    advanceState: 'carried_forward',
  });
}

/**
 * Get advance statistics for admin dashboard
 */
export async function getAdvanceStats(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
  totalPending: number;
  totalApproved: number;
}> {
  const advances = await getDocuments<AdvanceRequest>(COLLECTIONS.ADVANCES);

  const pending = advances.filter(a => a.status === 'pending');
  const approved = advances.filter(a => a.status === 'approved' && !isAdvanceDeducted(a));
  const rejected = advances.filter(a => a.status === 'rejected');

  return {
    pending: pending.length,
    approved: approved.length,
    rejected: rejected.length,
    totalPending: pending.reduce((sum, a) => sum + a.amount, 0),
    totalApproved: approved.reduce((sum, a) => sum + a.amount, 0),
  };
}

// =====================================================
// DEPRECATED / LEGACY (keep for migration)
// =====================================================

/**
 * @deprecated Use getAllPendingAdvances() instead
 * Old logic that mixed approved and pending
 * Handles both old (isDeducted) and new (deducted) field names
 */
export async function getPendingAdvancesByWorkerIds(workerIds: string[]): Promise<any[]> {
  if (!workerIds.length) return [];

  // Try new field name first
  const advances = await getDocuments<AdvanceRequest>(COLLECTIONS.ADVANCES, [
    where('employeeId', 'in', workerIds),
    where('deducted', '==', false),
  ]);

  // Try old field name  as fallback
  const advancesOld = await getDocuments<AdvanceRequest>(COLLECTIONS.ADVANCES, [
    where('employeeId', 'in', workerIds),
    where('isDeducted', '==', false),
  ]);

  // Merge and deduplicate
  const mergedMap = new Map<string, any>();
  for (const a of advances) {
    if (a.status === 'approved') {
      mergedMap.set(a.id, a);
    }
  }
  for (const a of advancesOld) {
    if (a.status === 'approved' && !mergedMap.has(a.id)) {
      mergedMap.set(a.id, a);
    }
  }

  return Array.from(mergedMap.values());
}

/**
 * @deprecated Use approveAdvance() with proper flow
 */
export async function checkDuplicatePendingAdvance(employeeId: string): Promise<boolean> {
  const docs = await getDocuments(COLLECTIONS.ADVANCES, [
    where('employeeId', '==', employeeId),
    where('status', '==', 'pending'),
  ]);
  return docs.length > 0;
}

/**
 * @deprecated Use specific update functions instead
 */
export async function updateAdvanceRequest(advanceId: string, data: Partial<AdvanceRequest>): Promise<void> {
  const advance = await getAdvance(advanceId);
  if (!advance) throw new Error('Advance not found');
  if (isAdvanceDeducted(advance)) throw new Error('This advance was already deducted in payroll and cannot be edited');
  await updateDocument(COLLECTIONS.ADVANCES, advanceId, data);
  await auditAction('update', 'advances', advanceId, { oldValue: { amount: advance.amount, reason: advance.reason }, newValue: data as Record<string, unknown> });
}

/**
 * @deprecated Use soft deletes via status instead
 */
export async function deleteAdvance(advanceId: string): Promise<void> {
  const advance = await getAdvance(advanceId);
  if (!advance) return;
  if (isAdvanceDeducted(advance)) throw new Error('This advance was already deducted in payroll and cannot be deleted');
  const { deleteDocument } = await import('@/lib/firebase/firestore');
  await deleteDocument(COLLECTIONS.ADVANCES, advanceId);
  await auditAction('delete', 'advances', advanceId, { oldValue: { employeeId: advance.employeeId, amount: advance.amount, status: advance.status } });
}

/**
 * Get carried-forward advances (approved, not deducted, marked as carry forward)
 */
export async function getCarriedForwardAdvances(): Promise<AdvanceRequest[]> {
  return getDocuments<AdvanceRequest>(COLLECTIONS.ADVANCES, [
    where('status', '==', 'approved'),
    where('isDeducted', '==', false),
    where('carryForward', '==', true),
  ]);
}

/**
 * Get deducted advances history
 */
export async function getDeductedAdvances(): Promise<AdvanceRequest[]> {
  return getDocuments<AdvanceRequest>(COLLECTIONS.ADVANCES, [
    where('isDeducted', '==', true),
  ]);
}

/**
 * Reset carry-forward flag for next week (make advances available for deduction again)
 */
export async function resetCarryForwardForWeek(
  advanceId: string
): Promise<void> {
  await updateDocument<AdvanceRequest>(COLLECTIONS.ADVANCES, advanceId, {
    carryForward: false,
    deductThisWeek: false,
  });
}
