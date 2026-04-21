import { Database } from "./src/db/client.ts";

async function main() {
    const extendDb = Database.getExtendedInstance();
    
    // Check payroll_history_header columns in extend_db_ptrj
    console.log("payroll_history_header columns in extend_db_ptrj:");
    try {
        const histCols = await extendDb.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'payroll_history_header'
            ORDER BY ORDINAL_POSITION
        `);
        histCols.forEach((r: any, i: number) => console.log(`${i+1}. ${r.COLUMN_NAME}`));
        console.log(`\nTotal: ${histCols.length} columns`);
    } catch (e: any) {
        console.log("Error:", e.message);
    }
}

main().catch(console.error);
