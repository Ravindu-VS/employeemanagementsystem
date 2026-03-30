const fs=require("fs"); let p="src/services/attendance-service.ts"; let t=fs.readFileSync(p, "utf8"); 
t = t.replace(/const otHours \= record\.otHours \|\| 0;\s*if \(otHours \> 0 \&\& \!record\.siteOtHours\) \{/, "const otHours = record.otHours || 0;\n    const hasSiteOtHours = record.siteOtHours && Object.keys(record.siteOtHours).length > 0;\n    if (otHours > 0 && !hasSiteOtHours) {");
fs.writeFileSync(p, t);
console.log("Regex replaced.");

