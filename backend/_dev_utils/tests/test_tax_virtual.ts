
import { taxReportService } from "../../src/services/taxReportService";
import { divisionDefinition } from "../../src/services/divisionDefinition";

async function test() {
    const divisions = ['INF', 'NRS', 'WORKSHOP', 'WKS_PG', 'WKS_AR'];
    const month = 3;
    const year = 2026;

    for (const div of divisions) {
        console.log(`\n=== Testing Division: ${div} ===`);
        try {
            const isVirtual = divisionDefinition.isVirtualDivision(div);
            console.log(`Is Virtual: ${isVirtual}`);
            
            const config = divisionDefinition.getVirtualDivisionConfig(div);
            console.log(`Config:`, config);

            const report = await taxReportService.getMonthlyTaxReport(year, month, div, "ALL", undefined, true);
            console.log(`Report result: ${report.employees.length} employees found.`);
            if (report.employees.length > 0) {
                console.log(`First employee: ${report.employees[0].emp_name} (${report.employees[0].gang_code})`);
            }
        } catch (error: any) {
            console.error(`Error testing ${div}:`, error.message);
        }
    }
}

test().then(() => process.exit(0));
