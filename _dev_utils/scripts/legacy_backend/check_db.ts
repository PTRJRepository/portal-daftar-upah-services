import { historyDatabaseService } from '../services/historyDatabaseService';

async function test() {
    try {
        console.log("Checking extend_db_ptrj for 2025 data...");
        // Call the service directly
        const result = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(1, 2025, "ALL", undefined);
        console.log("Result rows count for Month 1, 2025, ALL gangs, undefined division:");
        if (result) {
            console.log(result.data_rows.length, "rows found");
            const sample = result.data_rows[0];
            console.log("Sample:", {
                emp_code: sample?.emp_code,
                nama: sample?.nama,
                pph21_ter: sample?.pph21_ter,
                pot_pph21: sample?.pot_pph21
            });
        } else {
            console.log("NULL result returned (no headers found).");
        }

        // Test database directly
        const db = (historyDatabaseService as any).getPayrollDatabase();
        if (db) {
            const raw = await db.query(`SELECT TOP 5 id, period_month, period_year, gang_code, division_code FROM dbo.payroll_history_header ORDER BY id DESC`);
            console.log("Recent history headers:", raw);
        } else {
            console.log("Could not access direct DB client");
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
}

test();
