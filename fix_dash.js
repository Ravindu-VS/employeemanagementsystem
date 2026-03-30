const fs = require('fs');
let p = 'src/app/dashboard/payroll/page.tsx';
let t = fs.readFileSync(p, 'utf8');
t = t.replace(/â€”/g, '-');
fs.writeFileSync(p, t);
console.log('Fixed page!');
