/**
 * Debug: Test the complete taxReportService.getMonthlyTaxReport flow
 * to see what it returns for March 2026 with P1A division
 */
import { taxReportService } from "../../../src/services/taxReportService";

async function main() {
    console.log("=== DEBUG: Full Tax Report Flow Test ===\n");

    try {
        console.log("1. getMonthlyTaxReport(2026, 3, 'P1A', 'ALL', undefined):");
        const start = Date.now();
        const result = await taxReportService.getMonthlyTaxReport(2026, 3, 'P1A', 'ALL', undefined);
        console.log(`   Time: ${Date.now() - start}ms`);
        console.log(`   Employees: ${result.employees.length}`);
        console.log(`   Total PPh21: ${result.total_pph21}`);
        console.log(`   Data source: ${result.data_source}`);
        console.log(`   Period: ${result.period.month}/${result.period.year}`);

        if (result.employees.length > 0) {
            const first = result.employees[0];
            console.log("\n   First employee sample:");
            console.log(`      emp_code: ${first.emp_code}`);
            console.log(`      emp_name: ${first.emp_name}`);
            console.log(`      gang_code: ${first.gang_code}`);
            console.log(`      pph21_ter: ${first.pph21_ter}`);
            console.log(`      penghasilan_bruto: ${first.penghasilan_bruto}`);
            console.log(`      status_ptkp: ${first.status_ptkp}`);
            console.log(`      tarif_pajak_ter: ${first.tarif_pajak_ter}`);
        } else {
            console.log("\n   !!! NO EMPLOYEES RETURNED !!!");
            console.log("   This explains why report-pajak shows no data!");
        }

        console.log("\n2. getMonthlyTaxReport(2026, 3, undefined, 'ALL', undefined) - no division:");
        const start2 = Date.now();
        const result2 = await taxReportService.getMonthlyTaxReport(2026, 3, undefined, 'ALL', undefined);
        console.log(`   Time: ${Date.now() - start2}ms`);
        console.log(`   Employees: ${result2.employees.length}`);
        console.log(`   Total PPh21: ${result2.total_pph21}`);

    } catch (e: any) {
        console.log("   ERROR:", e.message);
        console.log("   Stack:", e.stack.split('\n').slice(0, 5).join('\n'));
    }

    console.log("\n=== END ===");
}

main().catch(console.error);
