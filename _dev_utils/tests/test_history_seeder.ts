import { historySeederService } from "../../backend/src/services/historySeederService";

async function run() {
    try {
        const options = {
            periodMonth: 2,
            periodYear: 2026,
            divisionCode: 'ALL',
            gangCode: 'A1H',
            createdBy: 'test_script',
            ipAddress: '127.0.0.1',
            userAgent: 'test',
            force: true,
            seederMode: 'PAYROLL'
        };
        console.log("Starting seedPayrollHistory...");
        const result = await historySeederService.seedPayrollHistory(options as any);
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Caught exception:", e);
    }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
