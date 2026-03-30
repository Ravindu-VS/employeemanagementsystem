const fs = require("fs"); 
let p = "src/app/dashboard/attendance/page.tsx"; 
let r = fs.readFileSync(p, "utf8"); 
r = `import { extractOtHours } from "@/domain/attendance";\n` + r; 
fs.writeFileSync(p, r); 
console.log("TS missing import fixed.");
