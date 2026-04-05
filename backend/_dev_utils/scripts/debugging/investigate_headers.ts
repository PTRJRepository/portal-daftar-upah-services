import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    
    // Check if payroll_history_detail has records linked to headers
    console.log("Checking payroll_history_detail for F1H headers:\n");
    
    // Check for header_id 3750
    const detail3750 = await extDb.query<any>(`
        SELECT COUNT(*) as cnt, SUM(upah_bersih) as total_bersih
        FROM dbo.payroll_history_detail
        WHERE master_id = 3750 OR history_id IN (
            SELECT history_id FROM dbo.payroll_history_master WHERE id = 3750
        )
    `);
    
    console.log(`Header 3750 (23 emp):`);
    console.log(`  Details: ${detail3750[0].cnt}`);
    console.log(`  Total bersih: ${(detail3750[0].total_bersih || 0).toLocaleString('id-ID')}`);
    
    // Check for header_id 3832
    const detail3832 = await extDb.query<any>(`
        SELECT COUNT(*) as cnt, SUM(upah_bersih) as total_bersih
        FROM dbo.payroll_history_detail
        WHERE master_id = 3832 OR history_id IN (
            SELECT history_id FROM dbo.payroll_history_master WHERE id = 3832
        )
    `);
    
    console.log(`\nHeader 3832 (32 emp):`);
    console.log(`  Details: ${detail3832[0].cnt}`);
    console.log(`  Total bersih: ${(detail3832[0].total_bersih || 0).toLocaleString('id-ID')}`);
    
    // Alternative: Check if there's another field or column with employee breakdown
    console.log("\n\nChecking ALL columns in payroll_history_header for F1H (ID 3832):\n");
    const allCols = await extDb.query<any>(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'payroll_history_header'
        ORDER BY ORDINAL_POSITION
    `);
    
    console.log("Available columns:");
    allCols.forEach((c: any) => console.log(`  ${c.COLUMN_NAME}`));
    
    // Get full header record
    const fullHeader = await extDb.query<any>(`
        SELECT *
        FROM dbo.payroll_history_header
        WHERE id = 3832
    `);
    
    console.log("\n\nFull header 3832 data:\n");
    for (const [key, value] of Object.entries(fullHeader[0])) {
        if (typeof value === 'number') {
            console.log(`  ${key}: ${value.toLocaleString('id-ID')}`);
        } else {
            console.log(`  ${key}: ${value}`);
        }
    }
}

main().catch(console.error);
