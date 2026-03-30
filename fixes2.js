
let fs = require("fs");
let p = "src/app/dashboard/reports/page.tsx";
let r = fs.readFileSync(p, "utf8");

// Remove missing exports
r = r.replace(/import \{.*?buildWorkerWeeklyPayrolls\,[\s\S]*?\} from .@\/domain\/payroll.;/, "import { calculatePayrollBreakdown } from \"@/domain/payroll\";");
r = r.replace(/\{workerData\.map\(\(worker\)/g, "{workerData.map((worker: any)");

fs.writeFileSync(p, r);
console.log("Reports TS fixed.");

