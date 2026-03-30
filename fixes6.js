const fs = require("fs"); 
let p = "src/app/dashboard/reports/page.tsx"; 
let r = fs.readFileSync(p, "utf8"); 
r = r.replace(/const workerPayrolls = \[\];/, "const workerPayrolls: any[] = [];"); 
r = r.replace(/summary\.totalGrossPay/g, "summary.totalGrossSalary");
fs.writeFileSync(p, r); 
console.log("Stubs fixed.");
