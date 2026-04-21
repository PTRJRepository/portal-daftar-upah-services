/**
 * Check why certain employees appear in multiple gangs
 */
import { Database } from "./backend/src/db/client";

async function checkMultiGangEmployees() {
    console.log("=== CHECKING MULTI-GANG EMPLOYEES ===\n");
    
    const db = Database.getInstance();
    
    // Check B0720 - RIYANDI PRATAMA
    console.log("--- Employee B0720 - RIYANDI PRATAMA ---");
    const b0720 = await db.query<any>(`
        SELECT 
            RTRIM(gl.GangMember) as emp_code,
            RTRIM(gl.GangCode) as gang_code,
            RTRIM(g.Description) as gang_desc,
            RTRIM(g.LocCode) as gang_loc
        FROM HR_GANGLN gl
        LEFT JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        WHERE RTRIM(gl.GangMember) = 'B0720'
        ORDER BY gl.GangCode
    `);
    
    console.log(`Found ${b0720.length} gang assignments for B0720:`);
    b0720.forEach(row => {
        console.log(`  Gang: ${row.gang_code} - ${row.gang_desc} (LocCode: ${row.gang_loc})`);
    });
    
    // Check F0440 - YUDIARTA
    console.log("\n--- Employee F0440 - YUDIARTA ---");
    const f0440 = await db.query<any>(`
        SELECT 
            RTRIM(gl.GangMember) as emp_code,
            RTRIM(gl.GangCode) as gang_code,
            RTRIM(g.Description) as gang_desc,
            RTRIM(g.LocCode) as gang_loc
        FROM HR_GANGLN gl
        LEFT JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        WHERE RTRIM(gl.GangMember) = 'F0440'
        ORDER BY gl.GangCode
    `);
    
    console.log(`Found ${f0440.length} gang assignments for F0440:`);
    f0440.forEach(row => {
        console.log(`  Gang: ${row.gang_code} - ${row.gang_desc} (LocCode: ${row.gang_loc})`);
    });
    
    // Check history_gang_member for 2/2026
    console.log("\n--- History Gang Member for B0720 and F0440 (2/2026) ---");
    const historyDb = Database.getExtendedInstance();
    
    const historyB0720 = await historyDb.query<any>(`
        SELECT 
            emp_code,
            emp_name,
            gang_code,
            period_month,
            period_year,
            created_at
        FROM dbo.history_gang_member
        WHERE emp_code = 'B0720' AND period_month = 2 AND period_year = 2026
        ORDER BY gang_code
    `);
    
    console.log(`\nB0720 in history_gang_member (2/2026): ${historyB0720.length} records`);
    historyB0720.forEach(row => {
        console.log(`  ${row.gang_code} - created: ${row.created_at}`);
    });
    
    const historyF0440 = await historyDb.query<any>(`
        SELECT 
            emp_code,
            emp_name,
            gang_code,
            period_month,
            period_year,
            created_at
        FROM dbo.history_gang_member
        WHERE emp_code = 'F0440' AND period_month = 2 AND period_year = 2026
        ORDER BY gang_code
    `);
    
    console.log(`\nF0440 in history_gang_member (2/2026): ${historyF0440.length} records`);
    historyF0440.forEach(row => {
        console.log(`  ${row.gang_code} - created: ${row.created_at}`);
    });
    
    // Check how many employees total have multiple gang assignments in HR_GANGLN
    console.log("\n--- All Employees with Multiple Gang Assignments ---");
    const multiGangAll = await db.query<any>(`
        SELECT 
            RTRIM(GangMember) as emp_code,
            COUNT(DISTINCT GangCode) as gang_count,
            STRING_AGG(RTRIM(GangCode), ', ') within group (order by GangCode) as gangs
        FROM HR_GANGLN
        GROUP BY RTRIM(GangMember)
        HAVING COUNT(DISTINCT GangCode) > 1
        ORDER BY gang_count DESC
    `);
    
    console.log(`Found ${multiGangAll.length} employees with multiple gang assignments in HR_GANGLN:`);
    if (multiGangAll.length > 0) {
        multiGangAll.slice(0, 20).forEach(row => {
            console.log(`  ${row.emp_code}: ${row.gang_count} gangs [${row.gangs}]`);
        });
        if (multiGangAll.length > 20) {
            console.log(`  ... and ${multiGangAll.length - 20} more`);
        }
    }
}

checkMultiGangEmployees().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
