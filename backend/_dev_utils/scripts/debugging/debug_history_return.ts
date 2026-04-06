/**
 * Debug: Test what getHistoricalPayrollDataAsExtractorFormat actually returns
 * for P1A division
 */
import { historyDatabaseService } from "../../../src/services/historyDatabaseService";

async function main() {
    console.log("=== DEBUG: Test getHistoricalPayrollDataAsExtractorFormat ===\n");

    try {
        console.log("1. Calling with (3, 2026, 'ALL', 'P1A'):");
        const result1 = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(3, 2026, 'ALL', 'P1A');
        console.log("   Result:", result1 ? `data_rows: ${result1.data_rows?.length || 0}` : 'NULL');
        if (result1 && result1.data_rows && result1.data_rows.length > 0) {
            const first = result1.data_rows[0];
            console.log("   First row keys:", Object.keys(first).slice(0, 20).join(', '));
            console.log("   First row sample:", JSON.stringify({
                emp_code: first.emp_code,
                emp_name: first.emp_name,
                gang_code: first.gang_code,
                division_code: first.division_code,
                pph21_ter: first.pph21_ter,
                status_ptkp: first.status_ptkp
            }));
        }

        console.log("\n2. Calling with (3, 2026, 'ALL', undefined) - no division:");
        const result2 = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(3, 2026, 'ALL', undefined);
        console.log("   Result:", result2 ? `data_rows: ${result2.data_rows?.length || 0}` : 'NULL');

        console.log("\n3. Calling with (3, 2026, 'ALL', 'ALL') - division='ALL':");
        const result3 = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(3, 2026, 'ALL', 'ALL');
        console.log("   Result:", result3 ? `data_rows: ${result3.data_rows?.length || 0}` : 'NULL');

    } catch (e: any) {
        console.log("   ERROR:", e.message);
        console.log("   Stack:", e.stack);
    }

    console.log("\n=== END ===");
}

main().catch(console.error);
