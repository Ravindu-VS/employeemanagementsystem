
const fs = require("fs");
let p = "src/services/payroll-service.ts";
let t = fs.readFileSync(p, "utf8");

// replace `calculateSiteBreakdown` and `aggregateWorkerPayroll` implementations
const siteBdRegex = /export function calculateSiteBreakdown\([\s\S]*?totalPay: basePay \+ otPay \};\n\s*\}/;
const newSiteBd = `export function calculateSiteBreakdown(siteId: string, siteName: string, daysWorked: number, otHours: number, dailyRate: number) {
  const otRate = calculateOtRate(dailyRate);
  const basePay = calculateBasePay(dailyRate, daysWorked, "helper"); // Domain takes fraction and daily rate
  const otPay = calculateOtPay(dailyRate, otHours);
  return { siteId, siteName, daysWorked, otHours, basePay, otRate, otPay, totalPay: basePay + otPay };
}`;
t = t.replace(siteBdRegex, newSiteBd);

fs.writeFileSync(p, t);
console.log("payroll updated.");

