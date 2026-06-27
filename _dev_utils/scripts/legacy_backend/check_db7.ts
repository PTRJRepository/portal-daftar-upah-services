import { historyDatabaseService } from '../services/historyDatabaseService';

async function test() {
    try {
        const db = (historyDatabaseService as any).getPayrollDatabase();

        const raw = await db.query(`
            SELECT TOP 20 d.division_code, d.loc_code, d.gang_code
            FROM dbo.payroll_history_detail d
            JOIN dbo.payroll_history_header h ON d.master_id = h.id
            WHERE h.period_year = 2025
        `);
        console.log("Samples of loc_code vs division_code:");
        console.log(JSON.stringify(raw));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
