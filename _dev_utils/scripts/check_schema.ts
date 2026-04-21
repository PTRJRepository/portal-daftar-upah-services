import { Database } from "./src/db/client.ts";

async function main() {
    console.log("=== Checking table schemas ===\n");
    
    const db = Database.getInstance();
    const extendDb = Database.getExtendedInstance();
    
    // Check PR_TASKREGLN columns
    console.log("1. PR_TASKREGLN columns (first 20):");
    try {
        const taskregCols = await db.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'PR_TASKREGLN'
            ORDER BY ORDINAL_POSITION
        `);
        console.log(taskregCols.map((r: any) => r.COLUMN_NAME).join(", "));
    } catch (e: any) {
        console.log("Error:", e.message);
    }
    
    // Check PR_ADTRANSLN columns
    console.log("\n2. PR_ADTRANSLN columns (first 20):");
    try {
        const adtransCols = await db.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'PR_ADTRANSLN'
            ORDER BY ORDINAL_POSITION
        `);
        console.log(adtransCols.map((r: any) => r.COLUMN_NAME).join(", "));
    } catch (e: any) {
        console.log("Error:", e.message);
    }
    
    // Check payroll_history_header columns
    console.log("\n3. payroll_history_header columns:");
    try {
        const histCols = await extendDb.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'payroll_history_header'
            ORDER BY ORDINAL_POSITION
        `);
        console.log(histCols.map((r: any) => r.COLUMN_NAME).join(", "));
    } catch (e: any) {
        console.log("Error:", e.message);
    }
    
    // Check if employee_estate exists
    console.log("\n4. Checking employee_estate table:");
    try {
        const empEstate = await db.query(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME LIKE '%employee%' OR TABLE_NAME LIKE '%estate%'
        `);
        console.log("Tables found:", empEstate.map((r: any) => r.TABLE_NAME).join(", "));
    } catch (e: any) {
        console.log("Error:", e.message);
    }
    
    console.log("\nDone!");
}

main().catch(console.error);
