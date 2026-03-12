/**
 * =====================================================
 * ADVANCE SERVICE
 * =====================================================
 * Data operations for salary advance management.
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
import { COLLECTIONS, PAYROLL_CONFIG } from '@/constants';
import type { 
  AdvanceRequest, 
  RequestStatus,
  PaginatedResponse, 
  PaginationParams,
} from '@/types';

/**
 * Get advance request by ID
 */
export async function getAdvance(advanceId: string): Promise<AdvanceRequest | null> {
  return getDocument<AdvanceRequest>(COLLECTIONS.ADVANCES, advanceId);
}

/**
 * Get all pending advance requests
 */
export async function getPendingAdvances(): Promise<AdvanceRequest[]> {
  return getDocuments<AdvanceRequest>(COLLECTIONS.ADVANCES, [
    where('status', '==', 'pending'),
    orderBy('requestedAt', 'asc'),
  ]);
}

/**
 * Get advances for an employee
 */
export async function getEmployeeAdvances(employeeId: string): Promise<AdvanceRequest[]> {
  return getDocuments<AdvanceRequest>(COLLECTIONS.ADVANCES, [
    where('employeeId', '==', employeeId),
    orderBy('requestedAt', 'desc'),
  ]);
}

/**
 * Get advances with pagination
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

/**
 * Create a new advance request
 */
export async function createAdvanceRequest(
  data: {
    employeeId: string;
    employeeName: string;
    amount: number;
    reason: string;
  }
): Promise<string> {
  // Validate amount
  if (data.amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }
  
  // Check for pending requests
  const pendingRequests = await getDocuments<AdvanceRequest>(COLLECTIONS.ADVANCES, [
    where('employeeId', '==', data.employeeId),
    where('status', '==', 'pending'),
  ]);
  
  if (pendingRequests.length > 0) {
    throw new Error('There is already a pending advance request');
  }
  
  const advanceData: Omit<AdvanceRequest, 'id' | 'createdAt' | 'updatedAt'> = {
    ...data,
    requestedAt: new Date(),
    status: 'pending',
    isDeducted: false,
  };
  
  return createDocument<AdvanceRequest>(COLLECTIONS.ADVANCES, advanceData as any);
}

/**
 * Approve an advance request
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
  
  await updateDocument<AdvanceRequest>(COLLECTIONS.ADVANCES, advanceId, {
    status: 'approved',
    reviewedBy,
    reviewedAt: new Date(),
    reviewNotes: notes,
  });
}

/**
 * Reject an advance request
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
}

/**
 * Cancel an advance request (by the employee)
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

/**
 * Mark advance as deducted from payroll
 */
export async function markAdvanceDeducted(
  advanceId: string,
  payrollWeekId: string
): Promise<void> {
  await updateDocument<AdvanceRequest>(COLLECTIONS.ADVANCES, advanceId, {
    isDeducted: true,
    deductionWeekId: payrollWeekId,
  });
}

/**
 * Get approved but not deducted advances for an employee
 */
export async function getUndeductedAdvances(employeeId: string): Promise<AdvanceRequest[]> {
  return getDocuments<AdvanceRequest>(COLLECTIONS.ADVANCES, [
    where('employeeId', '==', employeeId),
    where('status', '==', 'approved'),
    where('isDeducted', '==', false),
  ]);
}

/**
 * Get advance statistics
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
  const approved = advances.filter(a => a.status === 'approved' && !a.isDeducted);
  const rejected = advances.filter(a => a.status === 'rejected');
  
  return {
    pending: pending.length,
    approved: approved.length,
    rejected: rejected.length,
    totalPending: pending.reduce((sum, a) => sum + a.amount, 0),
    totalApproved: approved.reduce((sum, a) => sum + a.amount, 0),
  };
}
