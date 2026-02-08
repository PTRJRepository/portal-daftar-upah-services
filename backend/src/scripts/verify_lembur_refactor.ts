
import { lemburCalculator } from "../services/lemburCalculator";
import { PayrollComponentMetadata } from "../types/payroll/PayrollComponent";

async function verifyLemburRefactor() {
    console.log("Verifying Lembur Data Structure Refactor...");

    try {
        const { Database } = await import("../db/client");
        const db = Database.getInstance();

        // Find latest OT record
        const rows = await db.query<{ EmpCode: string, TrxDate: Date }>(`
            SELECT TOP 1 EmpCode, TrxDate 
            FROM PR_TASKREGLN 
            WHERE OT=1 
            ORDER BY TrxDate DESC
        `);

        if (rows.length === 0) {
            console.log("No OT records found in the entire database for verification test.");
            return;
        }

        const empCode = rows[0].EmpCode;
        const trxDate = new Date(rows[0].TrxDate);
        const month = trxDate.getMonth() + 1;
        const year = trxDate.getFullYear();

        console.log(`Found data for verification: EmpCode=${empCode}, Month=${month}, Year=${year}`);

        const result = await lemburCalculator.calculateBatchDataWithTaskBreakdown([empCode.trim()], month, year);
        const empData = result[empCode.trim()];

        if (!empData) {
            console.error("No data returned for employee.");
            return;
        }

        console.log("Checking Metadata...");
        if (empData.meta) {
            console.log("PASS: Employee level meta exists:", empData.meta);
        } else {
            console.error("FAIL: Employee level meta missing");
        }

        if (empData.records && empData.records.length > 0) {
            const firstRecord = empData.records[0];
            if (firstRecord.meta) {
                console.log("PASS: Record level meta exists:", firstRecord.meta);
            } else {
                console.error("FAIL: Record level meta missing");
            }
            if ((firstRecord as any).date) {
                console.log("PASS: Record has 'date' property:", (firstRecord as any).date);
            }
        } else {
            console.log("WARN: No detailed records found for this employee.");
        }

    } catch (e) {
        console.error("Verification failed:", e);
    }
}

verifyLemburRefactor().then(() => {
    console.log("Done.");
    process.exit(0);
});
