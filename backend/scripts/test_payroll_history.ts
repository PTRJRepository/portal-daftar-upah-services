import { historyDatabaseService } from '../src/services/historyDatabaseService';

async function main() {
    process.env.RUN_MODE = 'prod'; // force history mode
    const db = historyDatabaseService.getPayrollDatabase();

    // Check if payroll_history_detail has data for A0023
    console.log("Checking extend_db_ptrj...");
    try {
        const rows = await db.query(`
            SELECT TOP 12 m.period_month, m.period_year, d.gaji_pokok, d.jumlah_upah_kotor, d.total_potongan, d.upah_bersih
            FROM dbo.payroll_history_master m
            JOIN dbo.payroll_history_detail d ON m.id = d.master_id
            WHERE d.emp_code = 'A0023'
            ORDER BY m.period_year DESC, m.period_month DESC
        `);
        console.log(`Found ${rows.length} history records in local DB.`);
        console.log(rows);
    } catch (e: any) {
        console.error("extend DB check failed:", e.message);
    }
}

main().catch(console.error).finally(() => process.exit(0));
