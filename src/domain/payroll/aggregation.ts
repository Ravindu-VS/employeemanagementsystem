/**
 * =====================================================
 * PAYROLL AGGREGATION ENGINE
 * =====================================================
 * Core logic for building payroll summaries from attendance records.
 * Extracted from payroll/page.tsx for reusability.
 */

import { SimpleAttendance, UserProfile, SiteBreakdown } from "@/types";
import { isHigherRoleMultiSite } from "../roles";
import { calculateOtRate, calculateOtPay } from "./index";

/**
 * Intermediate record: attendance converted to site-specific work entries
 */
export interface AttendanceEntry {
  workerId: string;
  role: string;
  date: string;
  siteId: string;
  covered: boolean;
  otHours: number;
  dayFraction: number; // 0.5 for half-day shift, 1.0 for full-day (morning+evening at same site)
}

/**
 * Per-employee summary with site breakdowns
 */
export interface EmployeePayrollSummary {
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  daysWorked: number;
  otHours: number;
  grossPay: number;
  dailyRate: number;
  otRate: number;
  siteBreakdowns: SiteBreakdown[];
  advances: any[]; // TODO: type as Advance[]
}

/**
 * Site-wise payroll aggregate
 */
export interface SitePayrollAggregate {
  siteId: string;
  siteName: string;
  totalPayroll: number;
  workerCount: number;
  totalDays: number;
  totalOtHours: number;
}

/**
 * Grand payroll totals across all workers
 */
export interface PayrollGrandTotals {
  totalWorkers: number;
  totalDays: number;
  totalOtHours: number;
  grossPayroll: number;
  advanceDeductions: number;
  finalPayroll: number;
}

/**
 * Convert attendance records to site-specific work entries
 * Handles both supervisor multi-site and labor half-day models
 * Also detects and merges duplicate records (safeguard for race conditions in attendance save)
 */
export function buildAttendanceEntries(
  weekAttendance: SimpleAttendance[],
  employeeMap: Map<string, UserProfile>
): AttendanceEntry[] {
  // Debug: log date range and Sunday records
  if (weekAttendance.length > 0 && typeof window !== 'undefined') {
    const dates = weekAttendance.map(r => r.date).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];
    const sundayRecords = weekAttendance.filter(r => {
      const d = new Date(r.date + 'T00:00:00Z');
      return d.getUTCDay() === 0;
    });
    const uniqueDates = [...new Set(dates)];
    console.log('🔍 [SUNDAY-FIX] Attendance records audit:', {
      totalRecords: weekAttendance.length,
      dateRange: { min: minDate, max: maxDate },
      uniqueDatesCount: uniqueDates.length,
      sundayRecordsCount: sundayRecords.length,
      sundayDates: sundayRecords.map(r => r.date),
      allDatesWithWorkers: uniqueDates.map(date => ({
        date,
        dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(date + 'T00:00:00Z').getUTCDay()],
        recordCount: weekAttendance.filter(r => r.date === date).length,
      })),
    });
  }

  // Merge duplicate records for same (workerId, date) that may have been created
  // due to race conditions when marking attendance at multiple sites
  const mergedRecords = mergeDuplicateAttendanceRecords(weekAttendance);

  // Debug: log merged records
  const premakirthiRecords = mergedRecords.filter(r =>
    r.siteVisits?.some(v => v.siteId.includes('premakirthi') || v.siteId === 'rTFoxclBsJcrzmti49qF') ||
    r.morningSite?.includes('premakirthi') ||
    r.eveningSite?.includes('premakirthi')
  );
  if (premakirthiRecords.length > 0 && typeof window !== 'undefined') {
    console.log('🔍 [DEBUG] Premakirthi attendance records after merge:', {
      totalRecords: premakirthiRecords.length,
      records: premakirthiRecords.map(r => ({
        workerId: r.workerId,
        date: r.date,
        siteVisits: r.siteVisits?.map(v => ({ siteId: v.siteId, visited: v.visited })),
        morningSite: r.morningSite,
        eveningSite: r.eveningSite,
      }))
    });
  }

  const entries: AttendanceEntry[] = [];
  // Track seen (workerId, date, siteId) to prevent duplicates
  const seen = new Set<string>();
  const duplicatesFound: string[] = []; // For debugging

  for (const record of mergedRecords) {
    const emp = employeeMap.get(record.workerId);
    if (!emp) continue;

    const role = emp.role || record.role || 'helper';
    const isSupervisor = isHigherRoleMultiSite(role);

    if (isSupervisor) {
      // Supervisor: each visited site counts per siteVisits array
      if (record.siteVisits && record.siteVisits.length > 0) {
        // Debug: check all visits
        if (emp.uid && (emp.displayName?.includes('Kanchana') || emp.displayName?.includes('Nimal') || emp.displayName?.includes('Nishantha'))) {
          console.log(`🔍 [DEBUG] Supervisor ${emp.displayName} on ${record.date} has ${record.siteVisits.length} visits:`, record.siteVisits);
        }

        for (const visit of record.siteVisits) {
          if (visit.visited) {
            const key = `${record.workerId}:${record.date}:${visit.siteId}`;
            if (!seen.has(key)) {
              seen.add(key);
              entries.push({
                workerId: record.workerId,
                role,
                date: record.date,
                siteId: visit.siteId,
                covered: true,
                otHours: record.siteOtHours?.[visit.siteId] || 0,
                dayFraction: 1.0, // Supervisor full day per site
              });
            } else {
              // Log duplicate for debugging
              duplicatesFound.push(`Duplicate supervisor entry: ${emp.displayName || emp.email} @ ${visit.siteId} on ${record.date}`);
            }
          } else {
            // Visit not marked as visited - log this
            if (emp.uid && (emp.displayName?.includes('Kanchana') || emp.displayName?.includes('Nimal') || emp.displayName?.includes('Nishantha'))) {
              console.warn(`⚠️ [DEBUG] Supervisor ${emp.displayName} has visit.visited=false for ${visit.siteId} on ${record.date}`);
            }
          }
        }
      } else if (record.otHours && record.otHours > 0) {
        // Fallback for supervisors with legacy otHours but no siteVisits
        // Try to assign to morningSite or eveningSite if available
        const fallbackSite = record.eveningSite || record.morningSite;
        if (fallbackSite) {
          const key = `${record.workerId}:${record.date}:${fallbackSite}`;
          if (!seen.has(key)) {
            seen.add(key);
            entries.push({
              workerId: record.workerId,
              role,
              date: record.date,
              siteId: fallbackSite,
              covered: true,
              otHours: record.otHours,
              dayFraction: 1.0, // Supervisor full day
            });
          } else {
            duplicatesFound.push(`Duplicate supervisor fallback: ${emp.displayName || emp.email} @ ${fallbackSite} on ${record.date}`);
          }
        }
      }
    } else {
      // Labor: morning/evening half-days
      // Handle 3 cases:
      // 1. Both morning and evening at SAME site = 1 full day at that site
      // 2. Morning and evening at DIFFERENT sites = 0.5 at each site
      // 3. Only morning or only evening = 0.5 at that site

      const hasMorning = !!record.morningSite;
      const hasEvening = !!record.eveningSite;
      const sameShift = hasMorning && hasEvening && record.morningSite === record.eveningSite;

      // Debug for specific workers
      if (emp.uid && (emp.displayName?.includes('Nimal') || emp.displayName?.includes('Nishantha') || emp.displayName?.includes('Nadhan') || emp.displayName?.includes('Nuwan'))) {
        console.log(`🔍 [DEBUG] Labor ${emp.displayName} on ${record.date}: hasMorning=${hasMorning} (${record.morningSite}), hasEvening=${hasEvening} (${record.eveningSite}), sameShift=${sameShift}`);
      }

      // Debug: log records with no shifts (critical for finding missing workers)
      if (!hasMorning && !hasEvening && typeof window !== 'undefined') {
        const siteOtHoursStr = record.siteOtHours ? JSON.stringify(record.siteOtHours) : 'none';
        const genOt = Number(record.otHours || 0);
        const hasPositiveOt = siteOtHoursStr !== 'none' && siteOtHoursStr !== '{}'
          ? Object.values(record.siteOtHours!).some(v => Number(v) > 0)
          : genOt > 0;
        console.warn(`⚠️ [ATTENDANCE-CHECK] Labor ${emp.displayName || emp.email} on ${record.date}:
  morningSite: ${record.morningSite}
  eveningSite: ${record.eveningSite}
  otHours: ${genOt}
  siteOtHours: ${siteOtHoursStr}
  hasPositiveOT: ${hasPositiveOt}
  → Will ${hasPositiveOt ? 'BE INCLUDED' : 'BE EXCLUDED'} from payroll`);
      }

      if (sameShift) {
        // Case 1: Both shifts at same site = 1 full day
        const siteId = record.morningSite!; // Guaranteed non-null from sameShift check
        const key = `${record.workerId}:${record.date}:${siteId}`;
        if (!seen.has(key)) {
          seen.add(key);
          entries.push({
            workerId: record.workerId,
            role,
            date: record.date,
            siteId,
            covered: true,
            otHours: record.siteOtHours?.[siteId] || 0,
            dayFraction: 1.0, // ✅ Full day, not 2x 0.5
          });
        } else {
          duplicatesFound.push(`Duplicate labor entry: ${emp.displayName || emp.email} full-day @ ${siteId} on ${record.date}`);
        }
      } else {
        // Case 2 & 3: Half-day shifts at same or different sites
        if (hasMorning && record.morningSite) {
          const key = `${record.workerId}:${record.date}:${record.morningSite}`;
          if (!seen.has(key)) {
            seen.add(key);
            entries.push({
              workerId: record.workerId,
              role,
              date: record.date,
              siteId: record.morningSite,
              covered: true,
              otHours: record.siteOtHours?.[record.morningSite] || 0,
              dayFraction: 0.5, // Half-day
            });
          } else {
            duplicatesFound.push(`Duplicate labor entry: ${emp.displayName || emp.email} morning @ ${record.morningSite} on ${record.date}`);
          }
        }

        if (hasEvening && record.eveningSite) {
          const key = `${record.workerId}:${record.date}:${record.eveningSite}`;
          if (!seen.has(key)) {
            seen.add(key);
            entries.push({
              workerId: record.workerId,
              role,
              date: record.date,
              siteId: record.eveningSite,
              covered: true,
              otHours: record.siteOtHours?.[record.eveningSite] || 0,
              dayFraction: 0.5, // Half-day
            });
          } else {
            duplicatesFound.push(`Duplicate labor entry: ${emp.displayName || emp.email} evening @ ${record.eveningSite} on ${record.date}`);
          }
        }

        // ⚠️ CRITICAL VALIDATION: Record with no shifts and no sites
        // Only recover if there is REAL POSITIVE OT (not zero-valued fields)
        if (!hasMorning && !hasEvening) {
          const siteOtHoursKeys = record.siteOtHours ? Object.keys(record.siteOtHours) : [];

          // ONLY recover if at least one siteOtHours value is ACTUALLY > 0
          const hasPositiveSiteOt = siteOtHoursKeys.some(siteId => {
            const otValue = Number(record.siteOtHours![siteId]) || 0;
            return otValue > 0;
          });

          const hasGeneralOt = (record.otHours && Number(record.otHours) > 0) || false;
          const shouldRecover = hasPositiveSiteOt || hasGeneralOt;

          if (shouldRecover && siteOtHoursKeys.length > 0) {
            // Find first site with positive OT
            const primarySite = siteOtHoursKeys.find(siteId => (Number(record.siteOtHours![siteId]) || 0) > 0)
              || siteOtHoursKeys[0];
            const otHours = Number(record.siteOtHours![primarySite]) || 0;

            // Double-check before creating entry
            if (otHours > 0) {
              const key = `${record.workerId}:${record.date}:${primarySite}`;
              if (!seen.has(key)) {
                seen.add(key);
                // Record exists with REAL OT but no shift marking = count as 0.5 day (emergency/partial work)
                entries.push({
                  workerId: record.workerId,
                  role,
                  date: record.date,
                  siteId: primarySite,
                  covered: true,
                  otHours,
                  dayFraction: 0.5, // Emergency/partial work
                });
                if (typeof window !== 'undefined') {
                  console.log(`✅ [PAYABLE] Labor ${emp.displayName} on ${record.date}: Recovered from OT-only record at ${primarySite} (${otHours}h OT)`);
                }
              }
            } else if (typeof window !== 'undefined') {
              // Log rejection of zero-OT records
              console.debug(`⛔ [REJECTED] Labor ${emp.displayName} on ${record.date}: Empty/absent record (no sites, 0 OT) - NOT payable`);
            }
          } else if (typeof window !== 'undefined') {
            // Log rejection of records with no positive OT
            console.debug(`⛔ [REJECTED] Labor ${emp.displayName} on ${record.date}: No valid attendance or OT marked (hasMorning=${hasMorning}, hasEvening=${hasEvening}, positiveOT=${hasPositiveSiteOt})`);
          }
        }
      }

      // Fallback for general OT (legacy format)
      const genOt = record.otHours || 0;
      if (genOt > 0 && !record.siteOtHours) {
        const otSite = record.eveningSite || record.morningSite;
        if (otSite) {
          // Don't create another entry - OT is already included in the shift entries above
        }
      }
    }
  }

  // Log duplicates to console for debugging
  if (duplicatesFound.length > 0 && typeof window !== 'undefined') {
    console.warn('⚠️ Duplicate attendance entries prevented:', duplicatesFound);
  }

  return entries;
}

/**
 * Build per-employee payroll summaries from attendance entries and employee data
 */
export function buildEmployeeSummaries(
  entries: AttendanceEntry[],
  employeeMap: Map<string, UserProfile>,
  siteNameMap: Map<string, string>,
  advancesByEmployee: Map<string, any[]>
): EmployeePayrollSummary[] {
  const workerSiteData = new Map<
    string,
    {
      worker: UserProfile;
      sites: Record<string, { daysWorked: number; otHours: number }>;
      datesSeen: Set<string>; // Track dates to prevent double-counting
    }
  >();

  // Debug tracking for Premakirthi
  const premakirthiEntries: any[] = [];

  // Aggregate entries by worker and site (NO deduplication here - happens at record level)
  for (const entry of entries) {
    // Track Premakirthi entries
    if (entry.siteId === 'rTFoxclBsJcrzmti49qF') {
      premakirthiEntries.push({
        workerId: entry.workerId,
        workerName: employeeMap.get(entry.workerId)?.displayName,
        date: entry.date,
        dayFraction: entry.dayFraction,
        otHours: entry.otHours
      });
    }

    const worker = employeeMap.get(entry.workerId);
    if (!worker) continue;

    if (!workerSiteData.has(entry.workerId)) {
      workerSiteData.set(entry.workerId, { worker, sites: {}, datesSeen: new Set() });
    }

    const wData = workerSiteData.get(entry.workerId)!;
    if (!wData.sites[entry.siteId]) {
      wData.sites[entry.siteId] = { daysWorked: 0, otHours: 0 };
    }

    // Create unique key for date+site to prevent double-counting within a day
    const dateKey = `${entry.date}:${entry.siteId}`;

    // Count days using dayFraction (0.5 for half-day, 1.0 for full-day/supervisor)
    if (entry.date && !wData.datesSeen.has(dateKey)) {
      wData.sites[entry.siteId].daysWorked += entry.dayFraction;
      wData.datesSeen.add(dateKey);
    }

    // Add OT hours (safe to accumulate since entries are already deduplicated)
    wData.sites[entry.siteId].otHours += entry.otHours;
  }

  // Log Premakirthi entries for debugging
  if (premakirthiEntries.length > 0 && typeof window !== 'undefined') {
    console.log('🔍 [DEBUG] Premakirthi entries being processed:', premakirthiEntries);

    // Group by worker to show total days
    const byWorker: Record<string, number> = {};
    premakirthiEntries.forEach(e => {
      byWorker[e.workerName] = (byWorker[e.workerName] || 0) + e.dayFraction;
    });
    console.log('🔍 [DEBUG] Premakirthi total days per worker:', byWorker);

    // Check what was actually counted
    for (const [workerId, wData] of workerSiteData.entries()) {
      const premaSite = wData.sites['rTFoxclBsJcrzmti49qF'];
      if (premaSite) {
        console.log(`🔍 [DEBUG] ${wData.worker.displayName} Premakirthi days in summary:`, premaSite.daysWorked);
      }
    }

    // DETAILED: For Nishantha, show ALL records in Firestore that have morning/evening at Premakirthi
    console.log('🔍 [DEBUG] ===== DETAILED NISHANTHA PREMAKIRTHI ANALYSIS =====');
    const nishanthaPremaEntries = premakirthiEntries.filter(e => e.workerName?.includes('Nishantha'));
    console.log(`🔍 [DEBUG] Nishantha entries WITH Premakirthi (from Firestore):`, nishanthaPremaEntries);
    console.log(`🔍 [DEBUG] Total entries for Nishantha at Premakirthi: ${nishanthaPremaEntries.reduce((sum, e) => sum + e.dayFraction, 0)} days`);
    console.log('🔍 [DEBUG] ===== END ANALYSIS =====');
  }

  // Build summaries
  const summaries: EmployeePayrollSummary[] = [];

  for (const [workerId, data] of workerSiteData.entries()) {
    const emp = data.worker;
    const dailyRate = emp.dailyRate || 0;
    const otRate = calculateOtRate(dailyRate);

    const siteBreakdowns: SiteBreakdown[] = Object.entries(data.sites)
      .map(([siteId, s]) => ({
        siteId,
        siteName: siteNameMap.get(siteId) || siteId,
        daysWorked: s.daysWorked,
        otHours: s.otHours,
        regularPay: s.daysWorked * dailyRate,
        otPay: calculateOtPay(dailyRate, s.otHours),
        totalPay: s.daysWorked * dailyRate + calculateOtPay(dailyRate, s.otHours),
      }))
      .sort((a, b) => a.siteName.localeCompare(b.siteName));

    const empAdvances = advancesByEmployee.get(emp.uid) || [];

    summaries.push({
      employeeId: emp.uid,
      employeeName: emp.displayName || emp.email,
      employeeRole: emp.role,
      daysWorked: siteBreakdowns.reduce((s, b) => s + b.daysWorked, 0),
      otHours: siteBreakdowns.reduce((s, b) => s + b.otHours, 0),
      grossPay: siteBreakdowns.reduce((s, b) => s + b.totalPay, 0),
      dailyRate,
      otRate,
      siteBreakdowns,
      advances: empAdvances,
    });
  }

  return summaries.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

/**
 * Build site-wise payroll totals from employee summaries
 */
export function buildSiteTotals(
  employeeSummaries: EmployeePayrollSummary[]
): SitePayrollAggregate[] {
  const totalsMap = new Map<string, { aggregate: SitePayrollAggregate; workerIds: Set<string> }>();

  for (const emp of employeeSummaries) {
    for (const sb of emp.siteBreakdowns) {
      const existing = totalsMap.get(sb.siteId) || {
        aggregate: {
          siteId: sb.siteId,
          siteName: sb.siteName,
          totalPayroll: 0,
          workerCount: 0,
          totalDays: 0,
          totalOtHours: 0,
        },
        workerIds: new Set<string>(),
      };
      existing.aggregate.totalPayroll += sb.totalPay;
      existing.aggregate.totalDays += sb.daysWorked;
      existing.aggregate.totalOtHours += sb.otHours;

      // Track unique workers per site (avoid double-counting)
      existing.workerIds.add(emp.employeeId);

      totalsMap.set(sb.siteId, existing);
    }
  }

  // Convert to final array with correct workerCount
  return Array.from(totalsMap.values()).map(({ aggregate, workerIds }) => ({
    ...aggregate,
    workerCount: workerIds.size, // Unique worker count, not cumulative
  })).sort((a, b) => b.totalPayroll - a.totalPayroll);
}

/**
 * Build grand payroll totals
 */
export function buildGrandTotals(
  employeeSummaries: EmployeePayrollSummary[],
  selectedAdvanceDeductions: number
): PayrollGrandTotals {
  const totalWorkers = employeeSummaries.length;
  const totalDays = employeeSummaries.reduce((s, e) => s + e.daysWorked, 0);
  const totalOtHours = employeeSummaries.reduce((s, e) => s + e.otHours, 0);
  const grossPayroll = employeeSummaries.reduce((s, e) => s + e.grossPay, 0);

  return {
    totalWorkers,
    totalDays,
    totalOtHours,
    grossPayroll,
    advanceDeductions: selectedAdvanceDeductions,
    finalPayroll: grossPayroll - selectedAdvanceDeductions,
  };
}

/**
 * Merge duplicate attendance records for same (workerId, date)
 * Handles race condition where concurrent saves create multiple separate records
 * instead of properly merging into one. This is a safeguard in the payroll layer.
 *
 * For supervisors: merges siteVisits arrays
 * For labor: later record wins for morning/evening shifts
 */
function mergeDuplicateAttendanceRecords(records: SimpleAttendance[]): SimpleAttendance[] {
  const mergedMap = new Map<string, SimpleAttendance>();

  // Debug: count Premakirthi records before merge
  const premaCountBefore = records.filter(r =>
    r.siteVisits?.some(v => v.siteId === 'rTFoxclBsJcrzmti49qF') ||
    r.morningSite === 'rTFoxclBsJcrzmti49qF' ||
    r.eveningSite === 'rTFoxclBsJcrzmti49qF'
  ).length;

  for (const record of records) {
    const key = `${record.workerId}:${record.date}`;
    const existing = mergedMap.get(key);

    if (!existing) {
      // First record for this worker/date - store a copy
      mergedMap.set(key, { ...record });
    } else {
      // Merge with existing record

      // For supervisors: merge siteVisits arrays (union of all visited sites)
      if (record.siteVisits && record.siteVisits.length > 0) {
        const mergedVisits = [...(existing.siteVisits || [])];
        for (const visit of record.siteVisits) {
          if (!mergedVisits.find(v => v.siteId === visit.siteId && v.visited)) {
            mergedVisits.push(visit);
          }
        }
        existing.siteVisits = mergedVisits;
      }

      // Merge siteOtHours - later record's OT for each site takes precedence (not summed)
      // This prevents doubling when duplicate records exist
      if (record.siteOtHours) {
        const merged = { ...(existing.siteOtHours || {}) };
        for (const [siteId, otHours] of Object.entries(record.siteOtHours)) {
          // Don't sum - take the latest value (from the incoming record)
          merged[siteId] = Number(otHours) || 0;
        }
        existing.siteOtHours = merged;
      }

      // Recalculate total otHours from merged siteOtHours
      if (existing.siteOtHours) {
        existing.otHours = Object.values(existing.siteOtHours).reduce(
          (sum, h) => sum + (Number(h) || 0),
          0
        );
      }

      // For labor: DON'T overwrite - only add/update if explicitly set
      if (record.morningSite !== undefined && record.morningSite !== null) {
        existing.morningSite = record.morningSite;
      }
      if (record.eveningSite !== undefined && record.eveningSite !== null) {
        existing.eveningSite = record.eveningSite;
      }

      // Update timestamp to latest
      if (record.updatedAt) {
        existing.updatedAt = record.updatedAt;
      }
    }
  }

  const merged = Array.from(mergedMap.values());

  // Debug: count Premakirthi records after merge
  const premaCountAfter = merged.filter(r =>
    r.siteVisits?.some(v => v.siteId === 'rTFoxclBsJcrzmti49qF') ||
    r.morningSite === 'rTFoxclBsJcrzmti49qF' ||
    r.eveningSite === 'rTFoxclBsJcrzmti49qF'
  ).length;

  if ((premaCountBefore > 0 || premaCountAfter > 0) && typeof window !== 'undefined') {
    console.log(`🔍 [DEBUG] Premakirthi records: ${premaCountBefore} before merge → ${premaCountAfter} after merge`);
  }

  return merged;
}
