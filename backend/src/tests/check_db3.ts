import { historyDatabaseService } from '../services/historyDatabaseService';

async function test() {
    try {
        const db = (historyDatabaseService as any).getPayrollDatabase();
        if (db) {
            const raw = await db.query(`
                SELECT DISTINCT division_code, gang_code, period_month, period_year
                FROM dbo.payroll_history_header 
                WHERE period_year = 2025
            `);
            console.log("Distinct combinations:");
            console.log(JSON.stringify(raw));
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
