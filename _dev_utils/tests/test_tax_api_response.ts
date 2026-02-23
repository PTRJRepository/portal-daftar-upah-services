import { taxReportService } from '../../backend/src/services/taxReportService';

async function test() {
    try {
        console.log("Fetching GET /tax-report/monthly?year=2025&month=1&division=RBM&gang=ALL");
        const monthly = await taxReportService.getMonthlyTaxReport(2025, 1, 'RBM', 'ALL');
        console.log("Monthly data rows count:", monthly.employees?.length);
        if (monthly.employees?.length > 0) {
            console.log("Sample monthly row:", monthly.employees[0]);
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
