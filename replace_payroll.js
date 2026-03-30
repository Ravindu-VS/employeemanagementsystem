
const fs = require("fs");
let p = "src/services/payroll-service.ts";
let t = fs.readFileSync(p, "utf8");

// We need to inject the domain imports
t = t.replace(/import \{ calculateOtHourlyRate[^\}]*\} from .@\/lib\/salary-utils.;/, `import { calculateOtRate, calculateOtPay, calculateBasePay, calculatePayrollBreakdown } from "@/domain/payroll";`);

// Since `calculateOtHourlyRate` is gone, let us see if it is used
t = t.replace(/calculateOtHourlyRate/g, "calculateOtRate");

fs.writeFileSync(p, t);
console.log("payroll-service replaced.");

