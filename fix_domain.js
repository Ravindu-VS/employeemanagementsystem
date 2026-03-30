
let fs = require("fs");

let rolesPath = "src/domain/roles/index.ts";
let r = fs.readFileSync(rolesPath, "utf8");
r = r.replace(/Worker/g, "UserProfile");
fs.writeFileSync(rolesPath, r);

let mapperPath = "src/domain/roles/mappers.ts";
let m = fs.readFileSync(mapperPath, "utf8");
m = m.replace(/Worker/g, "UserProfile");
fs.writeFileSync(mapperPath, m);

let attPath = "src/domain/attendance/index.ts";
let a = fs.readFileSync(attPath, "utf8");
a = a.replace(/Worker/g, "UserProfile");
a = a.replace(/Object.values\(record.siteOtHours\)/, "Object.values(record.siteOtHours || {})");
fs.writeFileSync(attPath, a);

let payPath = "src/domain/payroll/index.ts";
let p = fs.readFileSync(payPath, "utf8");
p = p.replace(/Worker/g, "UserProfile");
fs.writeFileSync(payPath, p);

let advPath = "src/domain/advances/index.ts";
let adv = fs.readFileSync(advPath, "utf8");
adv = adv.replace(/!adv.isDeducted && !adv.isPaid/g, "!adv.deducted");
fs.writeFileSync(advPath, adv);

console.log("Domain fixed.");

