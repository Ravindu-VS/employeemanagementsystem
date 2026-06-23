/**
 * =====================================================
 * EMPLOYEE SERVICE
 * =====================================================
 * Data operations for employee management.
 */

import {
  getDocument,
  getDocuments,
  getPaginatedDocuments,
  createDocumentWithId,
  updateDocument,
  deleteDocument,
  query,
  where,
  orderBy,
} from '@/lib/firebase/firestore';
import { uploadProfilePhoto, deleteFileByUrl } from '@/lib/firebase/storage';
import { COLLECTIONS } from '@/constants';
import type { 
  UserProfile, 
  UserRole, 
  PaginatedResponse, 
  PaginationParams,
  EmployeeFilters,
} from '@/types';

// Firestore returns { id, ...data } — map id to uid for UserProfile
function mapUser(data: any): UserProfile {
  return { ...data, uid: data.uid || data.id };
}

/**
 * Get a single employee by ID
 */
export async function getEmployee(employeeId: string): Promise<UserProfile | null> {
  const doc = await getDocument<UserProfile>(COLLECTIONS.USERS, employeeId);
  return doc ? mapUser(doc) : null;
}

/**
 * Get all employees
 */
export async function getAllEmployees(): Promise<UserProfile[]> {
  const docs = await getDocuments<UserProfile>(COLLECTIONS.USERS, [
    orderBy('displayName', 'asc'),
  ]);
  return docs.map(mapUser);
}

/**
 * Get employees with filtering and pagination
 */
export async function getEmployees(
  params: PaginationParams,
  filters?: EmployeeFilters
): Promise<PaginatedResponse<UserProfile>> {
  const constraints = [];

  // Apply filters
  if (filters?.role) {
    constraints.push(where('role', '==', filters.role));
  }
  
  if (filters?.isActive !== undefined) {
    constraints.push(where('isActive', '==', filters.isActive));
  }
  
  if (filters?.siteId) {
    constraints.push(where('assignedSites', 'array-contains', filters.siteId));
  }
  
  if (filters?.supervisorId) {
    constraints.push(where('supervisorId', '==', filters.supervisorId));
  }

  return getPaginatedDocuments<UserProfile>(
    COLLECTIONS.USERS,
    params,
    constraints
  );
}

/**
 * Get employees by role
 */
export async function getEmployeesByRole(role: UserRole): Promise<UserProfile[]> {
  const results = await getDocuments<UserProfile>(COLLECTIONS.USERS, [
    where('role', '==', role),
    where('isActive', '==', true),
  ]);
  return results.map(mapUser).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
}

/**
 * Get employees assigned to a site
 */
export async function getEmployeesBySite(siteId: string): Promise<UserProfile[]> {
  const results = await getDocuments<UserProfile>(COLLECTIONS.USERS, [
    where('assignedSites', 'array-contains', siteId),
    where('isActive', '==', true),
  ]);
  return results.map(mapUser).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
}

/**
 * Get employees under a supervisor
 */
export async function getEmployeesBySupervisor(supervisorId: string): Promise<UserProfile[]> {
  const results = await getDocuments<UserProfile>(COLLECTIONS.USERS, [
    where('supervisorId', '==', supervisorId),
    where('isActive', '==', true),
  ]);
  return results.map(mapUser).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
}

/**
 * Create a new employee
 */
export async function createEmployee(
  uid: string,
  data: Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  await createDocumentWithId<UserProfile>(COLLECTIONS.USERS, uid, data as any);
}

/**
 * Update an employee
 */
export async function updateEmployee(
  employeeId: string,
  data: Partial<UserProfile>
): Promise<void> {
  await updateDocument<UserProfile>(COLLECTIONS.USERS, employeeId, data);
}

/**
 * Deactivate an employee (soft delete)
 */
export async function deactivateEmployee(employeeId: string): Promise<void> {
  await updateDocument<UserProfile>(COLLECTIONS.USERS, employeeId, {
    isActive: false,
  });
}

/**
 * Activate an employee
 */
export async function activateEmployee(employeeId: string): Promise<void> {
  await updateDocument<UserProfile>(COLLECTIONS.USERS, employeeId, {
    isActive: true,
  });
}

/**
 * Permanently delete an employee record
 */
export async function deleteEmployee(employeeId: string): Promise<void> {
  await deleteDocument(COLLECTIONS.USERS, employeeId);
}

/**
 * Update employee profile photo
 */
export async function updateEmployeePhoto(
  employeeId: string,
  photoFile: File
): Promise<string> {
  // Get current employee to check for existing photo
  const employee = await getEmployee(employeeId);
  
  // Delete old photo if exists
  if (employee?.photoURL) {
    try {
      await deleteFileByUrl(employee.photoURL);
    } catch (error) {
      console.warn('Failed to delete old photo:', error);
    }
  }
  
  // Upload new photo
  const photoURL = await uploadProfilePhoto(photoFile, employeeId);
  
  // Update employee record
  await updateDocument<UserProfile>(COLLECTIONS.USERS, employeeId, {
    photoURL,
  });
  
  return photoURL;
}

/**
 * Assign employee to sites
 */
export async function assignEmployeeToSites(
  employeeId: string,
  siteIds: string[]
): Promise<void> {
  await updateDocument<UserProfile>(COLLECTIONS.USERS, employeeId, {
    assignedSites: siteIds,
  });
}

/**
 * Update employee daily rate
 * NOTE: OT rate is now calculated as dailyRate / 8 at runtime
 */
export async function updateEmployeeRates(
  employeeId: string,
  dailyRate: number
): Promise<void> {
  await updateDocument<UserProfile>(COLLECTIONS.USERS, employeeId, {
    dailyRate,
    // Keep legacy fields calculated
    hourlyRate: dailyRate / 8,
    weeklyRate: dailyRate * 6,
  });
}

/**
 * Generate next workerId in WRK001 format
 */
export async function generateWorkerId(): Promise<string> {
  const employees = await getAllEmployees();
  const existingIds = employees
    .map(e => e.workerId)
    .filter(Boolean)
    .map(id => parseInt(id.replace('WRK', ''), 10))
    .filter(n => !isNaN(n));

  const nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
  return `WRK${String(nextNum).padStart(3, '0')}`;
}

/**
 * Get active employees only
 */
export async function getActiveEmployees(): Promise<UserProfile[]> {
  const results = await getDocuments<UserProfile>(COLLECTIONS.USERS, [
    where('isActive', '==', true),
  ]);
  return results.map(mapUser).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
}

/**
 * Reactivate a deactivated employee
 */
export async function reactivateEmployee(employeeId: string): Promise<void> {
  await updateDocument<UserProfile>(COLLECTIONS.USERS, employeeId, {
    isActive: true,
  });
}

/**
 * Get employee count by role
 */
export async function getEmployeeCountByRole(): Promise<Record<UserRole, number>> {
  const employees = await getAllEmployees();
  
  const counts: Record<string, number> = {};
  
  employees.forEach((employee) => {
    counts[employee.role] = (counts[employee.role] || 0) + 1;
  });
  
  return counts as Record<UserRole, number>;
}

/**
 * Search employees by name or email
 */
export async function searchEmployees(searchQuery: string): Promise<UserProfile[]> {
  // Firestore doesn't support full-text search
  // For production, consider using Algolia or Elasticsearch
  // This is a simple client-side filter
  const employees = await getAllEmployees();
  
  const query = searchQuery.toLowerCase();
  
  return employees.filter((employee) =>
    employee.displayName?.toLowerCase().includes(query) ||
    employee.email.toLowerCase().includes(query) ||
    employee.phone?.includes(query)
  );
}
