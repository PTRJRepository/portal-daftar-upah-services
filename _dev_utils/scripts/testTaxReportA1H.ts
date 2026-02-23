import { taxReportService } from "../../backend/src/services/taxReportService";
import * as fs from 'fs';

async function run() {
    try {
        console.log("Fetching A1H annual tax report...");
        const annualRes = await taxReportService.getAnnualTaxReport(2025, undefined, 'A1H');
        console.log("Annual total employees:", annualRes.employees.length);
        if (annualRes.employees.length > 0) {
            fs.writeFileSync('_dev_utils/scripts/out.json', JSON.stringify(annualRes.employees[0], null, 2));
            console.log("Saved to out.json");
        }
    } catch (err) {
        console.error("ERROR running tax report service:");
        console.error(err);
    }
    process.exit(0);
}

run();
