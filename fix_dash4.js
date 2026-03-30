const fs = require('fs');
let p = 'src/app/dashboard/payroll/page.tsx';
let t = fs.readFileSync(p, 'utf8');
t = t.split('â€”').join('-');
t = t.split('—').join('-');
fs.writeFileSync(p, t);
console.log('Fixed page globally!');
