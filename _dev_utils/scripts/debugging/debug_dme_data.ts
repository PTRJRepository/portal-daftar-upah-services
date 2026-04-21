/**
 * Debug: Check DME specific data in aggregation
 * Run: cd backend && bun run src/scripts/debug_dme_data.ts
 */

import { historyDatabaseService } from "../services/historyDatabaseService";
import { taxReportService } from "../services/taxReportService";
import { Database } from "../db/client";

async function main() {
    console.log("=== DEBUG DME DATA ===\n");

    const db = Database.getExtendedInstance();

    // 1. Check raw data in payroll_history_header for DME/March 2026
    console.log("1. Check payroll_history_header for DME...");
    try {
        const headers = await db.query<any>(`
            SELECT id, period_month, period_year, division_code, gang_code, created_at
            FROM dbo.payroll_history_header
            WHERE period_month = 3 AND period_year = 2026
            ORDER BY division_code, gang_code
        `);
        console.log(`   Total headers: ${headers.length}`);
        console.log("   Unique division_code values:", [...new Set(headers.map(h => h.division_code))]);
        console.log("   Unique gang_code values:", [...new Set(headers.map(h => h.gang_code))]);
        console.log("   Sample:", headers.slice(0, 5));
    } catch (e: any) {
        console.log("   ERROR:", e.message);
    }

    // 2. Check if any header has DME as division_code
    console.log("\n2. Check specifically for DME division_code...");
    try {
        const dmeHeaders = await db.query<any>(`
            SELECT id, period_month, period_year, division_code, gang_code
            FROM dbo.payroll_history_header
            WHERE period_month = 3 AND period_year = 2026
            AND (division_code LIKE '%DME%' OR division_code LIKE '%Dempo%' OR division_code = 'ALL')
        `);
        console.log(`   DME headers found: ${dmeHeaders.length}`);
        if (dmeHeaders.length > 0) {
            console.log("   DME sample:", dmeHeaders.slice(0, 5));
        }
    } catch (e: any) {
        console.log("   ERROR:", e.message);
    }

    // 3. Try the exact query that historyDatabaseService uses
    console.log("\n3. Simulate historyDatabaseService query...");
    try {
        const gangCode = 'E1H';
        const divisionCode = 'DME';

        // Get aliases for DME
        const { gangService } = await import('../services/gangService');
        const { divisionDefinition } = await import('../services/divisionDefinition');

        const allPossibleDivs = new Set<string>();
        const aliases = gangService.getAllDivisionAliases(divisionCode);
        aliases.forEach(a => allPossibleDivs.add(a));

        const sourceDivs = await divisionDefinition.getSourceDivisionsForAggregation(divisionCode);
        for (const sd of sourceDivs) {
            allPossibleDivs.add(sd);
            const srcAliases = gangService.getAllDivisionAliases(sd);
            srcAliases.forEach(a => allPossibleDivs.add(a));
        }

        console.log(`   DME aliases: ${aliases}`);
        console.log(`   Source divisions: ${sourceDivs}`);
        console.log(`   All possible divs: ${Array.from(allPossibleDivs)}`);

        const divList = Array.from(allPossibleDivs);
        const placeholders = divList.map(() => '?').join(',');

        const masterQuery = `
            SELECT id, division_code, gang_code, dynamic_premi_data
            FROM dbo.payroll_history_header
            WHERE period_month = 3 AND period_year = 2026
            AND (division_code IN (${placeholders}) OR division_code = 'ALL')
            AND (gang_code = ? OR gang_code = 'ALL')
        `;

        const masterParams = [...divList, gangCode];
        console.log(`   Query: ${masterQuery}`);
        console.log(`   Params: ${masterParams}`);

        const masters = await db.query(masterQuery, masterParams);
        console.log(`   Masters found: ${masters.length}`);
        if (masters.length > 0) {
            console.log("   Masters sample:", masters.slice(0, 3));
        }
    } catch (e: any) {
        console.log("   ERROR:", e.message);
    }

    // 4. Try getting data with gangCode = 'ALL' to see if that's the issue
    console.log("\n4. Try with gangCode = 'ALL' instead...");
    try {
        const data = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(3, 2026, 'ALL', 'DME');
        console.log(`   Data rows with ALL gangs: ${data?.data_rows?.length || 0}`);
    } catch (e: any) {
        console.log("   ERROR:", e.message);
    }

    // 5. Try taxReportService directly with specific division/gang
    console.log("\n5. Try taxReportService.getMonthlyTaxReport...");
    try {
        const report = await taxReportService.getMonthlyTaxReport(2026, 3, 'DME', 'E1H', undefined);
        console.log(`   Employees: ${report.employees.length}`);
        console.log(`   Total PPH21: ${report.total_pph21}`);
        console.log(`   Data source: ${report.data_source}`);
    } catch (e: any) {
        console.log("   ERROR:", e.message);
    }

    console.log("\n=== DONE ===");
}

main().catch(console.error);