import { historyDatabaseService } from '../services/historyDatabaseService';

async function test() {
    try {
        const db = (historyDatabaseService as any).getPayrollDatabase();

        const raw = await db.query(`
            SELECT DISTINCT d.division_code, d.gang_code
            FROM dbo.payroll_history_detail d
            JOIN dbo.payroll_history_header h ON d.history_header_id = h.id
            WHERE h.period_year = 2025
        `);
        console.log("Distinct divisions in DETAILS table:");
        console.table(raw);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
