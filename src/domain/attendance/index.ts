import { UserProfile, SimpleAttendance } from "@/types";
import { isHigherRoleMultiSite } from "../roles";

export function calculateDayFraction(record: SimpleAttendance): number {
  if (!record) return 0;

  if (isHigherRoleMultiSite(record.role)) {
    // Higher roles can have multi-site
    if (record.siteVisits && record.siteVisits.length > 0) {
      return record.siteVisits.filter(v => v.visited).length;
    }
  } else {
    // Labor logic: morning/evening fractions
    const hasMorning = !!record.morningSite;
    const hasEvening = !!record.eveningSite;

    if (hasMorning && hasEvening) return 1;
    if (hasMorning || hasEvening) return 0.5;
  }
  return 0;
}

export function extractOtHours(record: SimpleAttendance, siteId: string): number {
  if (record.siteOtHours && typeof record.siteOtHours[siteId] === "number") {
    return Number(record.siteOtHours[siteId]) || 0;
  }

  if (record.otHours) {
    if (isHigherRoleMultiSite(record.role)) {
      const firstSite = record.siteVisits?.find(v => v.visited)?.siteId;
      if (firstSite === siteId) return Number(record.otHours) || 0;
    } else {
      const fallbackSite = record.eveningSite || record.morningSite;
      if (fallbackSite === siteId) return Number(record.otHours) || 0;
    }
  }
  return 0;
}

export function calculateTotalOtHours(record: SimpleAttendance): number {
  const hasSiteOtHours = record.siteOtHours && Object.keys(record.siteOtHours).length > 0;
  if (hasSiteOtHours) {
    return Object.values(record.siteOtHours || {}).reduce((a, b) => Number(a || 0) + Number(b || 0), 0);
  }
  return Number(record.otHours || 0);
}

/**
 * Get all unique sites a worker visited in a attendance record
 */
export function getUniqueSites(record: SimpleAttendance): string[] {
  const sites = new Set<string>();

  if (isHigherRoleMultiSite(record.role)) {
    // Supervisor: use siteVisits array
    record.siteVisits?.forEach(visit => {
      if (visit.visited) sites.add(visit.siteId);
    });
  } else {
    // Labor: morning and evening
    if (record.morningSite) sites.add(record.morningSite);
    if (record.eveningSite) sites.add(record.eveningSite);
  }

  return Array.from(sites);
}

/**
 * Check if a record has any attendance marked
 */
export function hasAttendance(record: SimpleAttendance): boolean {
  if (isHigherRoleMultiSite(record.role)) {
    return record.siteVisits?.some(v => v.visited) ?? false;
  }
  return !!(record.morningSite || record.eveningSite);
}

/**
 * Check if a worker was marked at a specific site
 */
export function isMarkedAtSite(record: SimpleAttendance, siteId: string): boolean {
  if (isHigherRoleMultiSite(record.role)) {
    return record.siteVisits?.some(v => v.visited && v.siteId === siteId) ?? false;
  }
  return record.morningSite === siteId || record.eveningSite === siteId;
}

/**
 * Normalize attendance record to ensure consistent structure
 * Ensures legacy records are compatible with both attendance models
 */
export function normalizeAttendanceRecord(
  record: SimpleAttendance
): SimpleAttendance {
  // Ensure required fields exist
  const normalized = { ...record };

  // If role not set, determine from context (should be set by frontend)
  if (!normalized.role) {
    normalized.role = 'helper'; // default safe value
  }

  // Ensure siteOtHours is always an object
  if (!normalized.siteOtHours) {
    normalized.siteOtHours = {};
  }

  // For supervisors without siteVisits array, create empty array
  if (isHigherRoleMultiSite(normalized.role) && !normalized.siteVisits) {
    normalized.siteVisits = [];
  }

  return normalized;
}

/**
 * Get attendance summary for a worker on a specific date
 */
export interface AttendanceSummary {
  isPresent: boolean;
  isFull: boolean; // Full day (1.0 for labor, 1.0 for supervisors)
  isHalf: boolean; // Half day (0.5)
  dayFraction: number;
  sitesCount: number;
  otHours: number;
  sitesWorked: string[];
}

export function summarizeAttendance(
  record: SimpleAttendance
): AttendanceSummary {
  const dayFraction = calculateDayFraction(record);
  const otHours = calculateTotalOtHours(record);
  const sitesWorked = getUniqueSites(record);

  return {
    isPresent: dayFraction > 0,
    isFull: dayFraction >= 1,
    isHalf: dayFraction > 0 && dayFraction < 1,
    dayFraction,
    sitesCount: sitesWorked.length,
    otHours,
    sitesWorked,
  };
}
