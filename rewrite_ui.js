
let fs = require("fs");

let uiPaths = [
    "src/app/dashboard/attendance/page.tsx",
    "src/app/dashboard/payroll/page.tsx",
    "src/app/dashboard/reports/page.tsx"
];

for (let p of uiPaths) {
    if (fs.existsSync(p)) {
        let t = fs.readFileSync(p, "utf8");
        // OT extraction
        t = t.replace(/getOtForSite/g, "extractOtHours");
        t = t.replace(/import \{ extractOtHours \} from .@\/lib\/attendance-utils.;/g, ""); // strip bad regex
        t = t.replace(/import \{ getOtForSite \} from .@\/lib\/attendance-utils.;/g, "import { extractOtHours } from \"@/domain/attendance\";");
        
        // OT rate mapping
        t = t.replace(/calculateOtHourlyRate/g, "calculateOtRate");
        t = t.replace(/import \{ calculateOtRate \} from .@\/lib\/salary-utils.;/g, "import { calculateOtRate } from \"@/domain/payroll\";");
        t = t.replace(/import \{ calculateOtHourlyRate[^\}]*\} from .@\/lib\/salary-utils.;/g, "import { calculateOtRate } from \"@/domain/payroll\";");
        
        // Role mapping
        t = t.replace(/isSupervisorRole\((.*?)\)/g, "isHigherRoleMultiSite($1)");
        t = t.replace(/import \{ isHigherRoleMultiSite \} from .@\/lib\/attendance-utils.;/g, "import { isHigherRoleMultiSite } from \"@/domain/roles\";");
        t = t.replace(/import \{ isSupervisorRole[^\}]*\} from .@\/lib\/attendance-utils.;/g, "import { isHigherRoleMultiSite } from \"@/domain/roles\";");

        fs.writeFileSync(p, t);
    }
}
console.log("UI domain replacements done.");

