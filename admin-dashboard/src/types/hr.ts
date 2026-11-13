/**
 * =====================================================
 * RECRUITMENT, ASSETS, HR DOCUMENTS, MONITORING TYPES
 * =====================================================
 */

import type { UserRole } from './user';

// ---------- Recruitment ----------
export type CandidateStage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';

export interface JobPosting {
  id: string;
  title: string;
  role: UserRole;
  siteId?: string;
  description: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  minExperienceYears: number;
  dailyRateOffered?: number;
  status: 'open' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

export interface Candidate {
  id: string;
  jobId: string;
  name: string;
  phone: string;
  email?: string;
  experienceYears: number;
  resumeText: string;
  extractedSkills: string[];
  matchScore: number;
  stage: CandidateStage;
  notes?: string;
  rejectionReason?: string;
  stageChangedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------- Assets ----------
export type AssetStatus = 'available' | 'assigned' | 'maintenance' | 'retired';
export type AssetCategory = 'tool' | 'equipment' | 'vehicle' | 'safety' | 'it' | 'other';

export interface AssetHistoryEntry {
  at: string; // ISO timestamp
  action: 'created' | 'assigned' | 'returned' | 'maintenance' | 'retired' | 'updated';
  by: string;
  employeeId?: string;
  siteId?: string;
  note?: string;
}

export interface Asset {
  id: string;
  assetTag: string;
  name: string;
  category: AssetCategory;
  serialNo?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  condition: 'good' | 'fair' | 'poor' | 'damaged';
  status: AssetStatus;
  assignedToEmployeeId?: string | null;
  assignedSiteId?: string | null;
  history: AssetHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

// ---------- HR documents (for the HR assistant) ----------
export interface HrDocument {
  id: string;
  title: string;
  category: 'policy' | 'leave' | 'payroll' | 'safety' | 'general';
  content: string;
  audience: 'all' | 'admins';
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------- Monitoring ----------
export interface ClientErrorLog {
  id: string;
  message: string;
  stack?: string;
  url: string;
  userId?: string;
  userAgent?: string;
  appVersion?: string;
  createdAt: Date;
}
