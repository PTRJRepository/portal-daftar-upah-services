import { historyDatabaseService } from "../../src/services/historyDatabaseService";
import { Database } from "../../src/db/client";
import { Config } from "../../src/config";

async function main() {
    const db = historyDatabaseService.getPayrollDatabase();
    
    console.log("Checking payroll_history_header...");
    const headerCount = await db.queryOne<{count: number}>("SELECT COUNT(*) as count FROM dbo.payroll_history_header", []);
    console.log(`Total rows in payroll_history_header: ${headerCount?.count}`);

    console.log("Checking payroll_history_detail...");
    const detailCount = await db.queryOne<{count: number}>("SELECT COUNT(*) as count FROM dbo.payroll_history_detail", []);
    console.log(`Total rows in payroll_history_detail: ${detailCount?.count}`);

    console.log("\nChecking rows by period:");
    const periods = await db.query<{period_month: number, period_year: number, count: number}>(
        "SELECT period_month, period_year, COUNT(*) as count FROM dbo.payroll_history_header GROUP BY period_month, period_year ORDER BY period_year DESC, period_month DESC", 
        []
    );
    console.table(periods);

    if (periods.length > 0) {
        const latest = periods[0];
        console.log(`\nChecking divisions for ${latest.period_month}/${latest.period_year}:`);
        const divisions = await db.query<{division_code: string, count: number}>(
            "SELECT division_code, COUNT(*) as count FROM dbo.payroll_history_header WHERE period_month = ? AND period_year = ? GROUP BY division_code",
            [latest.period_month, latest.period_year]
        );
        console.table(divisions);
    }
}

main().catch(console.error);
