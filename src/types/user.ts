/**
 * =====================================================
 * USER & AUTHENTICATION TYPES
 * =====================================================
 */

/**
 * User roles in the system hierarchy
 * Order represents hierarchy level (owner > ceo > manager > supervisor > others)
 */
export type UserRole = 
  | 'owner'
  | 'ceo'
  | 'manager'
  | 'supervisor'
  | 'draughtsman'
  | 'bass'
  | 'helper'
  | 'driver';

/**
 * Authentication status
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/**
 * User approval status for signup flow
 */
export type UserStatus = 'pending' | 'active' | 'rejected';

/**
 * Pay type determines how salary is calculated
 * site_based: paid per site visit (supervisors, managers)
 * daily_based: paid per day regardless of site (drivers, office staff)
 */
export type PayType = 'site_based' | 'daily_based';

/**
 * Base user interface from Firebase Auth + Firestore
 */
export interface User {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole | null;
  isActive: boolean;
  approved: boolean;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Extended user profile stored in Firestore
 */
export interface UserProfile extends User {
  workerId: string; // Format: WRK001, WRK002, etc.
  phone: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  dateOfBirth?: Date;
  joiningDate: Date;
  experience?: string;
  departmentId?: string;
  supervisorId?: string;
  assignedSites: string[];
  dailyRate: number;   // Per day payment
  /** @deprecated stored value is ignored — OT rate is always dailyRate ÷ 8 */
  otRate: number;
  /** Daily salary history; the rate effective on each attendance date is used. */
  salaryHistory?: SalaryHistoryEntry[];
  /** Previous worker IDs (attendance stored under them still belongs here). */
  formerWorkerIds?: string[];
  removedAt?: Date;
  /** Per-site-visit pay for multi-site roles (Supervisor). Falls back to settings. */
  siteVisitRate?: number;
  /** Driver details (role = driver) */
  driverLicenseNumber?: string;
  vehicleId?: string;
  hourlyRate: number;  // Legacy / calculated
  weeklyRate: number;  // Legacy / calculated
  payType: PayType;    // How salary is calculated
  bankDetails?: BankDetails;
  documents: UserDocument[];
  metadata: UserMetadata;
  // Transport settings
  transportType?: 'company_vehicle' | 'bus' | 'van' | 'fuel_allowance' | 'travel_allowance' | 'none';
  pickupLocation?: string;
  dropLocation?: string;
  distance?: number;
  transportRate?: number;
  transportRateType?: 'per_km' | 'per_day' | 'per_week' | 'per_site' | 'distance_band';
}

export interface SalaryHistoryEntry {
  dailyRate: number;
  effectiveFrom: string; // yyyy-MM-dd (Colombo calendar date)
  changedBy?: string;
  changedAt?: string;    // ISO timestamp
  reason?: string;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  ifscCode?: string;
  branchName?: string;
}

export interface UserDocument {
  id: string;
  type: 'id_proof' | 'address_proof' | 'photo' | 'contract' | 'other';
  name: string;
  url: string;
  uploadedAt: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
}

export interface UserMetadata {
  lastLoginAt?: Date;
  lastActiveAt?: Date;
  loginCount: number;
  deviceInfo?: string;
  appVersion?: string;
}
