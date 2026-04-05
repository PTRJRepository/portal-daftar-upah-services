import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    
    // Check if there's a table/view with gang descriptions in extend_db_ptrj
    const tables = await extDb.query<any>(`
        SELECT TABLE_NAME, TABLE_TYPE
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME LIKE '%GANG%' OR TABLE_NAME LIKE '%HR%'
        ORDER BY TABLE_NAME
    `);
    
    console.log("Tables in extend_db_ptrj related to GANG/HR:\n");
    for (const t of tables) {
        console.log(`  ${t.TABLE_NAME} (${t.TABLE_TYPE})`);
    }
    
    // Check if history_gang_member has gang descriptions
    try {
        const gangMembers = await extDb.query<any>(`
            SELECT TOP 10 gang_code, jabaran, jabatan
            FROM dbo.history_gang_member
            WHERE gang_code IS NOT NULL
            ORDER BY id DESC
        `);
        
        console.log("\n\nhistory_gang_member gang data:\n");
        for (const row of gangMembers) {
            console.log(`gang_code: "${row.gang_code}" | jabaran: "${row.jabaran}" | jabatan: "${row.jabatan}"`);
        }
    } catch (e: any) {
        console.log(`\nCould not query history_gang_member: ${e.message}`);
    }
    
    // Check payroll_history_detail
    try {
        const details = await extDb.query<any>(`
            SELECT TOP 5 gang_code, emp_name, jabatan
            FROM dbo.payroll_history_detail
            WHERE gang_code IS NOT NULL
        `);
        
        console.log("\n\npayroll_history_detail data:\n");
        for (const row of details) {
            console.log(`gang_code: "${row.gang_code}" | jabatan: "${row.jabatan || '(none)'}"`);
        }
    } catch (e: any) {
        console.log(`\nCould not query payroll_history_detail: ${e.message}`);
    }
    
    // Check if there's a gang master/reference table
    try {
        const gangRef = await extDb.query<any>(`
            SELECT TOP 10 GangCode, Description
            FROM dbo.HR_GANG
            WHERE GangCode IS NOT NULL
            ORDER BY GangCode
        `);
        
        console.log("\n\nHR_GANG in extend_db_ptrj:\n");
        for (const row of gangRef) {
            console.log(`${row.GangCode}: "${row.Description || '(empty)'}"`);
        }
    } catch (e: any) {
        console.log(`\nCould not query HR_GANG in extend_db: ${e.message}`);
    }
}

main().catch(console.error);
