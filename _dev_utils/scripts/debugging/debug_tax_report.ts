/**
 * Debug Tax Report Script
 * Run: cd backend && bun run src/scripts/debug_tax_report.ts
 */

import { Database } from "../db/client";
import { historyDatabaseService } from "../services/historyDatabaseService";
import { taxReportService } from "../services/taxReportService";

async function main() {
    console.log("=== DEBUG TAX REPORT ===\n");

    // 1. Check DB Connection
    console.log("1. Testing DB Connection...");
    const db = Database.getExtendedInstance();
    try {
        const result = await db.queryOne<{cnt: number}>("SELECT COUNT(*) as cnt FROM daftar_upah_aggregation_history WHERE month = ? AND year = ?", [3, 2026]);
        console.log("   History count for March 2026:", result?.cnt);
    } catch (e: any) {
        console.log("   ERROR:", e.message);
    }

    // 2. Check if data exists in history
    console.log("\n2. Checking history data for March 2026...");
    try {
        const historyData = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(3, 2026, 'ALL', undefined);
        console.log("   History rows found:", historyData?.data_rows?.length || 0);
    } catch (e: any) {
        console.log("   ERROR:", e.message);
    }

    // 3. Try to get monthly tax report
    console.log("\n3. Getting Monthly Tax Report for March 2026...");
    try {
        const report = await taxReportService.getMonthlyTaxReport(2026, 3, undefined, 'ALL', undefined);
        console.log("   Employees found:", report.employees.length);
        console.log("   Total PPH21:", report.total_pph21);
        console.log("   Data source:", report.data_source);
    } catch (e: any) {
        console.log("   ERROR:", e.message);
        console.log("   Stack:", e.stack);
    }

    console.log("\n=== DONE ===");
}

main().catch(console.error);