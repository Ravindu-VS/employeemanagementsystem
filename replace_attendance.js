const fs = require("fs");
let p = "src/services/attendance-service.ts";
let t = fs.readFileSync(p, "utf8");

// Replace imports
t = t.replace(/import \{ isSupervisorRole[^\}]*\} from .@\/lib\/attendance-utils.;/, `import { isHigherRoleMultiSite } from "@/domain/roles";\nimport { calculateDayFraction, extractOtHours, calculateTotalOtHours } from "@/domain/attendance";`);

t = t.replace(/isSupervisorRole\(/g, "isHigherRoleMultiSite(");

// We need to fix `getWorkerWeeklyAttendanceSummary` which we modified before, now we can use our domain functions.
const summaryBlockRegex = /export async function getWorkerWeeklyAttendanceSummary[\s\S]*?return \{ daysWorked\, otHours \};\n\}/;
const newSummaryBlock = `export async function getWorkerWeeklyAttendanceSummary(
  workerId: string,
  startDate: string,
  endDate: string
): Promise<{ daysWorked: number; otHours: number }> {
  const records = await getDocuments<SimpleAttendance>(SIMPLE_ATTENDANCE_COLLECTION, [
    where("workerId", "==", workerId),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
  ]);

  let daysWorked = 0;
  let otHours = 0;

  for (const record of records) {
    daysWorked += calculateDayFraction(record);
    otHours += calculateTotalOtHours(record);
  }

  return { daysWorked, otHours };
}`;
t = t.replace(summaryBlockRegex, newSummaryBlock);

fs.writeFileSync(p, t);
console.log("attendance-service replaced.");

