/**
 * Debug script: Test taxReportService.getMonthlyTaxReport directly
 * untuk melihat apa yang sebenarnya dikembalikan
 */
import { taxReportService } from "../../../src/services/taxReportService";

async function main() {
    console.log("=== DEBUG: Direct Call to taxReportService.getMonthlyTaxReport ===\n");

    const divisions = ['P1A', 'P1B', 'P2A', 'P2B', 'AB1', 'AB2', 'ARA', 'ARC', 'DME', 'IJL', 'NRS', 'INF', 'ALL'];

    for (const div of divisions) {
        console.log(`\n--- Division: ${div} ---`);
        try {
            const result = await taxReportService.getMonthlyTaxReport(2026, 3, div, 'ALL', undefined);
            console.log(`   Employees: ${result.employees.length}`);
            console.log(`   Total PPh21: ${result.total_pph21}`);
            console.log(`   Data source: ${result.data_source}`);

            if (result.employees.length > 0) {
                const first = result.employees[0];
                console.log(`   Sample: ${first.emp_code} | ${first.emp_name} | pph21_ter: ${first.pph21_ter}`);
            }
        } catch (e: any) {
            console.log(`   ERROR: ${e.message}`);
        }
    }

    console.log("\n=== END ===");
}

main().catch(console.error);
