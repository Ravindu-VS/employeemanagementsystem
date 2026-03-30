import { UserProfile, SimpleAttendance, Advance } from "@/types";
import { resolveEffectiveRole } from "./index";

/**
 * Maps an older worker record (which might have `designation`, `position`, etc.)
 * to the strict modern `UserProfile` / `UserProfile` shape, ensuring `role` is correctly populated.
 */
export function mapLegacyUserProfileToModern(worker: any): UserProfile {
  return {
    ...worker,
    role: resolveEffectiveRole(worker),
    // Remove or ignore legacy fields if necessary
    // OT rate deprecation logic here:
    // we do not map `otRate` into the new domain logic to ensure it\x27s calculated safely at runtime.
    otRate: undefined, 
  } as UserProfile;
}

/**
 * Safely extracts a normalized version of attendance.
 * If legacy attendance uses `otHours`, map it correctly, or fallback safely.
 */
export function normalizeLegacyAttendance(record: any): SimpleAttendance {
  return {
    ...record,
    role: resolveEffectiveRole({ role: record.role }),
    siteOtHours: record.siteOtHours || {},
  } as SimpleAttendance;
}

