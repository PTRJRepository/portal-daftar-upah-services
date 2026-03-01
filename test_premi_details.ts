import { employeeDetailService } from "./backend/src/services/employeeDetailService";

async function run() {
    try {
        const db = require("./backend/src/db/client").Database.getInstance();
        const rows = await db.query("SELECT TOP 1 EmpCode FROM PR_ADTRANS WHERE DocDesc LIKE '%PREMI%'");
        if (rows.length > 0) {
            const empCode = rows[0].EmpCode;
            console.log("Testing employee:", empCode);
            const data = await employeeDetailService.getEmployeeCheckroll(empCode, 2, 2026);
            console.log("Payroll Data:", JSON.stringify(data.payroll_data?.premi_details, null, 2));
            console.log("Raw Premi object:", JSON.stringify(data.payroll_data?.premi, null, 2));
        } else {
            console.log("No employees with PREMI found");
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
