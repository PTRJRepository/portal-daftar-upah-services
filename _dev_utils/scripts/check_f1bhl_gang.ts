/**
 * Check F1BHL gang existence and data
 */
import { Database } from "./backend/src/db/client";

async function checkF1BHL() {
    console.log("=== CHECKING F1BHL GANG ===\n");
    
    const db = Database.getInstance();
    
    // Check if F1BHL exists in HR_GANGLN
    console.log("--- F1BHL in HR_GANGLN ---");
    const f1bhlGang = await db.query<any>(`
        SELECT DISTINCT
            RTRIM(gl.GangCode) as gang_code,
            RTRIM(g.Description) as gang_desc,
            RTRIM(g.LocCode) as gang_loc
        FROM HR_GANGLN gl
        LEFT JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        WHERE RTRIM(gl.GangCode) = 'F1BHL'
    `);
    
    if (f1bhlGang.length > 0) {
        console.log(`✅ F1BHL exists in HR_GANGLN:`);
        f1bhlGang.forEach(row => {
            console.log(`  Gang: ${row.gang_code} - ${row.gang_desc} (LocCode: ${row.gang_loc})`);
        });
        
        // Count employees in F1BHL
        const empCount = await db.query<any>(`
            SELECT COUNT(*) as emp_count
            FROM HR_GANGLN gl
            WHERE RTRIM(gl.GangCode) = 'F1BHL'
        `);
        console.log(`\n👥 Employees in F1BHL: ${empCount[0].emp_count}`);
    } else {
        console.log("❌ F1BHL NOT found in HR_GANGLN");
    }
    
    // Check if there are F1B* gangs (F1H, F1M, F1T, F1B, F1BHL, etc.)
    console.log("\n--- All F1* gangs in HR_GANGLN ---");
    const f1Gangs = await db.query<any>(`
        SELECT DISTINCT
            RTRIM(gl.GangCode) as gang_code,
            RTRIM(g.Description) as gang_desc,
            RTRIM(g.LocCode) as gang_loc,
            COUNT(DISTINCT RTRIM(gl.GangMember)) as emp_count
        FROM HR_GANGLN gl
        LEFT JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        WHERE gl.GangCode LIKE 'F1%'
        GROUP BY RTRIM(gl.GangCode), RTRIM(g.Description), RTRIM(g.LocCode)
        ORDER BY RTRIM(gl.GangCode)
    `);
    
    console.log(`Found ${f1Gangs.length} F1* gangs:\n`);
    f1Gangs.forEach(row => {
        console.log(`  ${row.gang_code} - ${row.gang_desc} (LocCode: ${row.gang_loc}) - ${row.emp_count} employees`);
    });
    
    // Check if any F1BHL employees exist in HR_EMPLOYEE
    console.log("\n--- Employees in F1BHL ---");
    const f1bhlEmployees = await db.query<any>(`
        SELECT 
            RTRIM(gl.GangMember) as emp_code,
            RTRIM(e.EmpName) as emp_name,
            RTRIM(e.LocCode) as emp_loc
        FROM HR_GANGLN gl
        LEFT JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(gl.GangMember)
        WHERE RTRIM(gl.GangCode) = 'F1BHL'
    `);
    
    if (f1bhlEmployees.length > 0) {
        console.log(`Found ${f1bhlEmployees.length} employees in F1BHL:\n`);
        f1bhlEmployees.forEach(row => {
            console.log(`  ${row.emp_code} - ${row.emp_name} (LocCode: ${row.emp_loc})`);
        });
    } else {
        console.log("⚠️ No employees found in F1BHL gang");
    }
    
    // Check HR_GANG table for F1BHL
    console.log("\n--- F1BHL in HR_GANG table ---");
    const f1bhlInGang = await db.query<any>(`
        SELECT 
            RTRIM(GangCode) as gang_code,
            RTRIM(Description) as description,
            RTRIM(LocCode) as loc_code
        FROM HR_GANG
        WHERE RTRIM(GangCode) = 'F1BHL'
           OR RTRIM(Description) = 'F1BHL'
    `);
    
    if (f1bhlInGang.length > 0) {
        console.log(`✅ F1BHL found in HR_GANG:`);
        f1bhlInGang.forEach(row => {
            console.log(`  ${row.gang_code} - ${row.description} (LocCode: ${row.loc_code})`);
        });
    } else {
        console.log("❌ F1BHL NOT found in HR_GANG table");
    }
    
    console.log("\n=== CHECK COMPLETE ===");
}

checkF1BHL().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
