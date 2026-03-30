
let fs = require("fs");

let p1 = "src/services/attendance-service.ts";
let d1 = fs.readFileSync(p1, "utf8");
d1 = d1.replace(/Object\.values\(record\.siteOtHours\)/g, "Object.values(record.siteOtHours || {})");
fs.writeFileSync(p1, d1);

let p2 = "src/services/payroll-service.ts";
let d2 = fs.readFileSync(p2, "utf8");
d2 = d2.replace(/import \{ buildWorkerWeeklyPayrolls\, type WorkerWeeklyPayroll\, type FinalPayrollSummary \} from .@\/lib\/domain\/payroll-engine.;/, "");
d2 = d2.replace(/getWorkerWeeklyAttendanceBySite\(workerId\, weekStartStr\, weekEndStr\, employee\.role\);/, "getWorkerWeeklyAttendanceBySite(workerId, weekStartStr, weekEndStr);");
fs.writeFileSync(p2, d2);

console.log("Services patched.");

