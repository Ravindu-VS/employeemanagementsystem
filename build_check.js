
let fs = require("fs");
let c = fs.readFileSync("src/app/dashboard/reports/page.tsx", "utf8");
console.log(c.substring(0, 500));

