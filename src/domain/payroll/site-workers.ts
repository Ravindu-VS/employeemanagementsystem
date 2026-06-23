/**
 * Helper to build site-worker breakdown from employee payroll summaries
 * Transforms: employee.siteBreakdowns[] → grouped by siteId with worker list
 *
 * Used for UI only - no payroll logic changes
 */

export interface SiteWorkerRow {
  workerId: string;
  workerName: string;
  role?: string;
  daysWorked: number;
  totalSalary: number;
}

export interface SiteWorkerSummary {
  siteId: string;
  siteName: string;
  totalSalary: number;
  totalDays: number;
  workers: SiteWorkerRow[];
}

/**
 * Build site-worker summaries from employee payroll data
 * Groups each worker's site breakdown by site
 *
 * @param employeeSummaries - Array of computed employee payroll summaries
 * @returns Array of site summaries with worker breakdowns
 */
export function buildSiteWorkerSummaries(employeeSummaries: any[]): SiteWorkerSummary[] {
  const siteMap = new Map<string, {
    siteName: string;
    workers: SiteWorkerRow[];
    totalSalary: number;
    totalDays: number;
  }>();

  // Iterate through all employees and their site breakdowns
  for (const emp of employeeSummaries) {
    for (const sb of emp.siteBreakdowns || []) {
      const siteId = sb.siteId;

      // Initialize site if not exists
      if (!siteMap.has(siteId)) {
        siteMap.set(siteId, {
          siteName: sb.siteName,
          workers: [],
          totalSalary: 0,
          totalDays: 0,
        });
      }

      const siteData = siteMap.get(siteId)!;

      // Add worker row
      siteData.workers.push({
        workerId: emp.employeeId,
        workerName: emp.employeeName,
        role: emp.employeeRole,
        daysWorked: sb.daysWorked,
        totalSalary: sb.totalPay,
      });

      // Update totals
      siteData.totalSalary += sb.totalPay;
      siteData.totalDays += sb.daysWorked;
    }
  }

  // Convert to array and sort workers by name within each site
  return Array.from(siteMap.entries())
    .map(([siteId, data]) => ({
      siteId,
      siteName: data.siteName,
      totalSalary: data.totalSalary,
      totalDays: data.totalDays,
      workers: data.workers.sort((a, b) => a.workerName.localeCompare(b.workerName)),
    }))
    .sort((a, b) => a.siteName.localeCompare(b.siteName));
}
