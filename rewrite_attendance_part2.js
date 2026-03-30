const fs = require("fs");
let p = "src/services/attendance-service.ts";
let t = fs.readFileSync(p, "utf8");

// let\x27s rewrite getWorkerWeeklyAttendanceBySite to use the Domain engines
const getBySiteRegex = /export async function getWorkerWeeklyAttendanceBySite[\s\S]*?return siteMap;\n  \}/;

const newBySite = `export async function getWorkerWeeklyAttendanceBySite(
  workerId: string,
  startDate: string,
  endDate: string
): Promise<Record<string, { daysWorked: number; otHours: number }>> {
  const records = await getDocuments<SimpleAttendance>(SIMPLE_ATTENDANCE_COLLECTION, [
    where("workerId", "==", workerId),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
  ]);

  const siteMap: Record<string, { daysWorked: number; otHours: number }> = {};

  for (const record of records) {
    const isSupervisor = isHigherRoleMultiSite(record.role);

    if (isSupervisor) {
      const visitedSites = (record.siteVisits || []).filter(v => v.visited);
      for (const visit of visitedSites) {
        if (!siteMap[visit.siteId]) siteMap[visit.siteId] = { daysWorked: 0, otHours: 0 };
        siteMap[visit.siteId].daysWorked += 1;
        siteMap[visit.siteId].otHours += extractOtHours(record, visit.siteId);
      }
    } else {
      const morningSite = record.morningSite;
      const eveningSite = record.eveningSite;

      if (morningSite) {
        if (!siteMap[morningSite]) siteMap[morningSite] = { daysWorked: 0, otHours: 0 };
        siteMap[morningSite].daysWorked += 0.5;
        // only add OT once per site
        siteMap[morningSite].otHours += extractOtHours(record, morningSite);
      }

      if (eveningSite && eveningSite !== morningSite) {
        if (!siteMap[eveningSite]) siteMap[eveningSite] = { daysWorked: 0, otHours: 0 };
        siteMap[eveningSite].daysWorked += 0.5;
        siteMap[eveningSite].otHours += extractOtHours(record, eveningSite);
      } else if (eveningSite === morningSite && eveningSite) {
        siteMap[eveningSite].daysWorked += 0.5;
        // OT already added in morning block, site map OT gets mapped.
      }
    }
  }

  return siteMap;
}`;

t = t.replace(getBySiteRegex, newBySite);
fs.writeFileSync(p, t);
console.log("Attendance By Site simplified.");

