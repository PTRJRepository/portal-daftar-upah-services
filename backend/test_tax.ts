import { taxReportService } from "./src/services/taxReportService";
import { Database } from "./src/db/client";

async function run() {
    try {
        console.log("Testing getMonthlyTaxReport for Div P1A, Gang ALL");
        const res = await taxReportService.getMonthlyTaxReport(2025, 1, 'P1A', undefined);

        console.log(`Returned ${res.employees.length} employees`);

        // Check divisions of the returned employees
        const divs = new Set();
        const gangs = new Set();
        for (const e of res.employees) {
            gangs.add(e.gang_code);
            // The service doesn't return division_code on the employee row in getMonthlyTaxReport
            // But we can check gangs
        }
        console.log(`Gangs in result:`, Array.from(gangs));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
