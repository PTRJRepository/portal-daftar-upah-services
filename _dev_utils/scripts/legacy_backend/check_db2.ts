import { historyDatabaseService } from '../services/historyDatabaseService';

async function test() {
    try {
        const db = (historyDatabaseService as any).getPayrollDatabase();

        // Let's sum up rows grouped by division_code
        const raw = await db.query(`
            SELECT TOP 20 id, period_month, period_year, gang_code, division_code 
            FROM dbo.payroll_history_header 
            ORDER BY id DESC
        `);
        console.log("Headers table (TOP 20):", raw);

        // Fetch with division="RBM"
        const rbm = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(1, 2025, "ALL", "RBM");
        console.log("Rows with division RBM:", rbm?.data_rows.length || 0);

        // Fetch with division="IJL"
        const ijl = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(1, 2025, "ALL", "IJL");
        console.log("Rows with division IJL:", ijl?.data_rows.length || 0);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
