const fs=require("fs"); let p="src/services/attendance-service.ts"; let t=fs.readFileSync(p, "utf8"); 

const repl = `export async function getWorkerWeeklyAttendanceSummary(
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
    const isSupervisor = ["owner", "ceo", "manager", "supervisor"].includes((record.role || "").trim().toLowerCase());

    if (isSupervisor && record.siteVisits && record.siteVisits.length > 0) {
      // For supervisors, each visited site counts as 1 day
      const visited = record.siteVisits.filter(v => v.visited);
      daysWorked += visited.length;
    } else {
      const hasMorning = record.morningSite !== null;
      const hasEvening = record.eveningSite !== null;

      if (hasMorning && hasEvening && record.morningSite !== record.eveningSite) {
        // Different sites, 1 day
        daysWorked += 1;
      } else if (hasMorning && hasEvening && record.morningSite === record.eveningSite) {
        // Same site both shifts
        daysWorked += 1;
      } else if (hasMorning || hasEvening) {
        daysWorked += 0.5;
      }
    }

    // Accurate OT summation (either from dictionary or fallback to raw number)
    const hasSiteOtHours = record.siteOtHours && Object.keys(record.siteOtHours).length > 0;
    if (hasSiteOtHours) {
        otHours += Object.values(record.siteOtHours).reduce((a, b) => Number(a) + Number(b), 0);
    } else {
        otHours += record.otHours || 0;
    }
  }

  return { daysWorked, otHours };
}`;

t = t.replace(/export async function getWorkerWeeklyAttendanceSummary\([\s\S]*?return \{ daysWorked\, otHours \};\n  \}/, repl);
fs.writeFileSync(p, t);
console.log("Summary patched.");

