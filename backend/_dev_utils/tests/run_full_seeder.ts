/**
 * Script to run full seeder (ALL mode) for Jan 2026
 * Seeds payroll_history_detail + history_hr_employee + history_hr_gang
 */
import { historySeederService } from "../../src/services/historySeederService";
import { historyDatabaseService } from "../../src/services/historyDatabaseService";

async function runFullSeeder() {
    console.log("=== Running Full Seeder (ALL mode) for Jan 2026 ===");

    if (!historyDatabaseService.isHistoryMode()) {
        console.error("ERROR: History mode not enabled. Set RUN_MODE=prod");
        process.exit(1);
    }

    const result = await historySeederService.seedPayrollHistory({
        periodMonth: 1,
        periodYear: 2026,
        createdBy: 'system-migration',
        force: true,
        seederMode: 'ALL'
    });

    console.log("\n=== RESULT ===");
    console.log("Success:", result.success);
    console.log("History ID:", result.history_id);
    console.log("Total Employees:", result.total_employees);
    console.log("Records Inserted:", JSON.stringify(result.records_inserted, null, 2));
    if (result.errors.length > 0) {
        console.log("Errors:", result.errors);
    }

    // Verify payroll_history_detail now has rows
    const db = historyDatabaseService.getPayrollDatabase();
    const count = await db.query(`SELECT COUNT(*) as cnt FROM dbo.payroll_history_detail`);
    console.log("\npayroll_history_detail row count:", count[0]?.cnt);

    const headerCount = await db.query(`SELECT COUNT(*) as cnt FROM dbo.payroll_history_header`);
    console.log("payroll_history_header row count:", headerCount[0]?.cnt);

    process.exit(result.success ? 0 : 1);
}

runFullSeeder().catch(e => { console.error("Fatal:", e); process.exit(1); });
