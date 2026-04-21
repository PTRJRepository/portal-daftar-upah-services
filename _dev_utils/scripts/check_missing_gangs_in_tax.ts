/**
 * Check why F1BHL and F2 gangs are missing from Tax Report
 */
import { Database } from "./backend/src/db/client";

async function checkMissingGangs() {
    console.log("=== CHECKING MISSING GANGS IN TAX REPORT ===\n");
    
    const db = Database.getInstance();
    
    // Check F1BHL gang details
    console.log("--- F1BHL Gang in HR_GANG ---");
    const f1bhlGang = await db.query<any>(`
        SELECT 
            RTRIM(GangCode) as gang_code,
            RTRIM(Description) as description,
            RTRIM(LocCode) as loc_code
        FROM HR_GANG
        WHERE RTRIM(GangCode) = 'F1BHL'
    `);
    
    if (f1bhlGang.length > 0) {
        console.log(`✅ F1BHL exists:`);
        f1bhlGang.forEach(row => {
            console.log(`  ${row.gang_code} - ${row.description} (LocCode: ${row.loc_code})`);
        });
    } else {
        console.log("❌ F1BHL NOT in HR_GANG");
    }
    
    // Check F1BHL in HR_GANGLN
    console.log("\n--- F1BHL in HR_GANGLN ---");
    const f1bhlGangLn = await db.query<any>(`
        SELECT 
            RTRIM(gl.GangCode) as gang_code,
            RTRIM(gl.GangMember) as emp_code,
            RTRIM(e.EmpName) as emp_name,
            RTRIM(e.LocCode) as emp_loc
        FROM HR_GANGLN gl
        LEFT JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(gl.GangMember)
        WHERE RTRIM(gl.GangCode) = 'F1BHL'
    `);
    
    if (f1bhlGangLn.length > 0) {
        console.log(`✅ F1BHL has ${f1bhlGangLn.length} employees in HR_GANGLN:`);
        f1bhlGangLn.forEach(row => {
            console.log(`  ${row.emp_code} - ${row.emp_name} (LocCode: ${row.emp_loc})`);
        });
    } else {
        console.log("❌ F1BHL NOT in HR_GANGLN (no employees)");
    }
    
    // Check F2 gang
    console.log("\n--- F2 Gang in HR_GANG ---");
    const f2Gang = await db.query<any>(`
        SELECT 
            RTRIM(GangCode) as gang_code,
            RTRIM(Description) as description,
            RTRIM(LocCode) as loc_code
        FROM HR_GANG
        WHERE RTRIM(GangCode) = 'F2'
    `);
    
    if (f2Gang.length > 0) {
        console.log(`✅ F2 exists:`);
        f2Gang.forEach(row => {
            console.log(`  ${row.gang_code} - ${row.description} (LocCode: ${row.loc_code})`);
        });
    } else {
        console.log("❌ F2 NOT in HR_GANG");
    }
    
    // Check F2 in HR_GANGLN
    console.log("\n--- F2 in HR_GANGLN ---");
    const f2GangLn = await db.query<any>(`
        SELECT 
            RTRIM(gl.GangCode) as gang_code,
            RTRIM(gl.GangMember) as emp_code,
            RTRIM(e.EmpName) as emp_name,
            RTRIM(e.LocCode) as emp_loc
        FROM HR_GANGLN gl
        LEFT JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(gl.GangMember)
        WHERE RTRIM(gl.GangCode) = 'F2'
    `);
    
    if (f2GangLn.length > 0) {
        console.log(`✅ F2 has ${f2GangLn.length} employees in HR_GANGLN:`);
        f2GangLn.forEach(row => {
            console.log(`  ${row.emp_code} - ${row.emp_name} (LocCode: ${row.emp_loc})`);
        });
    } else {
        console.log("❌ F2 NOT in HR_GANGLN (no employees)");
    }
    
    // Check all ARA gangs in HR_GANG
    console.log("\n--- All ARA Gangs in HR_GANG (LocCode = 'ARA') ---");
    const araGangs = await db.query<any>(`
        SELECT 
            RTRIM(GangCode) as gang_code,
            RTRIM(Description) as description
        FROM HR_GANG
        WHERE RTRIM(LocCode) = 'ARA'
        ORDER BY GangCode
    `);
    
    console.log(`Found ${araGangs.length} ARA gangs in HR_GANG:\n`);
    araGangs.forEach(row => {
        console.log(`  ${row.gang_code} - ${row.description}`);
    });
    
    // Check if gang descriptions match between HR_GANG and what Tax Report expects
    console.log("\n--- Checking Description Matching Logic ---");
    console.log("Tax Report matches gangs by: GangCode OR Description");
    
    // Test query like Tax Report does
    console.log("\n--- Test Query (like Tax Report) for ARA gangs ---");
    const testQuery = await db.query<any>(`
        SELECT 
            RTRIM(gl.GangCode) as gang_code,
            RTRIM(g.Description) as gang_desc,
            COUNT(DISTINCT RTRIM(gl.GangMember)) as emp_count
        FROM HR_GANGLN gl
        INNER JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        WHERE UPPER(RTRIM(g.LocCode)) = 'ARA'
        GROUP BY RTRIM(gl.GangCode), RTRIM(g.Description)
        ORDER BY RTRIM(gl.GangCode)
    `);
    
    console.log(`\nARA gangs with employee count:\n`);
    testQuery.forEach(row => {
        console.log(`  ${row.gang_code} - ${row.gang_desc}: ${row.emp_count} employees`);
    });
    
    console.log("\n=== CHECK COMPLETE ===");
    console.log("\n💡 Analysis:");
    console.log("   - If F1BHL and F2 exist in HR_GANG but not in Tax Report,");
    console.log("     the issue is in how Tax Service queries or filters gangs");
    console.log("   - Check if the historical path (PR_GANGLN_ARC) has these gangs");
}

checkMissingGangs().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
