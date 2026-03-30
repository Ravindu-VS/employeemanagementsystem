
let fs = require("fs");
let p = "src/app/dashboard/reports/page.tsx";
let r = fs.readFileSync(p, "utf8");

// replace lib imports
r = r.replace(/@\/lib\/domain\/payroll-engine/g, "@/domain/payroll");
r = r.replace(/calculateOverallPayroll/g, "calculateOverallPayroll"); // Actually let\x27s see if we need to remove standard math.
// add types loosely if needed
r = r.replace(/wp \=\>/g, "(wp: any) =>");
r = r.replace(/s \=\>/g, "(s: any) =>");
r = r.replace(/w \=\>/g, "(w: any) =>");
r = r.replace(/sb \=\>/g, "(sb: any) =>");
r = r.replace(/worker \=\>/g, "(worker: any) =>");
r = r.replace(/sb, idx/g, "sb: any, idx: number");

fs.writeFileSync(p, r);
console.log("Reports page typed slightly cleanly for compilation.");

