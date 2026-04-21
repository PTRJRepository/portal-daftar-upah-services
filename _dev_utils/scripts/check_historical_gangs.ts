/**
 * Check PR_GANGLN_ARC for F1BHL and F2 gangs in 2/2026
 */
import { Database } from "./backend/src/db/client";

async function checkHistoricalGangs() {
    console.log("=== CHECKING PR_GANGLN_ARC for F1BHL and F2 ===\n");
    
    const db = Database.getInstance();
    
    // Check F1BHL in PR_GANGLN_ARC for 2/2026
    console.log("--- F1BHL in PR_GANGLN_ARC (2/2026) ---");
    const f1bhlArc = await db.query<any>(`
        SELECT 
            RTRIM(gl.EmpCode) as emp_code,
            RTRIM(g.GangID) as gang_id,
            RTRIM(g.Description) as gang_desc,
            gl.AccMonth,
            gl.AccYear
        FROM PR_GANGLN_ARC gl
        INNER JOIN PR_GANG g ON g.ID = gl.MasterID
        WHERE (UPPER(RTRIM(g.GangID)) = 'F1BHL' OR UPPER(RTRIM(g.Description)) LIKE '%F1BHL%')
          AND gl.AccMonth = 2
          AND gl.AccYear = 2026
    `);
    
    if (f1bhlArc.length > 0) {
        console.log(`✅ F1BHL found in PR_GANGLN_ARC with ${f1bhlArc.length} employees:\n`);
        f1bhlArc.forEach(row => {
            console.log(`  ${row.emp_code} - ${row.gang_id} (${row.gang_desc})`);
        });
    } else {
        console.log("❌ F1BHL NOT in PR_GANGLN_ARC for 2/2026");
    }
    
    // Check F2 in PR_GANGLN_ARC for 2/2026
    console.log("\n--- F2 in PR_GANGLN_ARC (2/2026) ---");
    const f2Arc = await db.query<any>(`
        SELECT 
            RTRIM(gl.EmpCode) as emp_code,
            RTRIM(g.GangID) as gang_id,
            RTRIM(g.Description) as gang_desc,
            gl.AccMonth,
            gl.AccYear
        FROM PR_GANGLN_ARC gl
        INNER JOIN PR_GANG g ON g.ID = gl.MasterID
        WHERE (UPPER(RTRIM(g.GangID)) = 'F2' OR UPPER(RTRIM(g.Description)) LIKE '%F2%')
          AND gl.AccMonth = 2
          AND gl.AccYear = 2026
    `);
    
    if (f2Arc.length > 0) {
        console.log(`✅ F2 found in PR_GANGLN_ARC with ${f2Arc.length} employees:\n`);
        f2Arc.slice(0, 10).forEach(row => {
            console.log(`  ${row.emp_code} - ${row.gang_id} (${row.gang_desc})`);
        });
        if (f2Arc.length > 10) {
            console.log(`  ... and ${f2Arc.length - 10} more`);
        }
    } else {
        console.log("❌ F2 NOT in PR_GANGLN_ARC for 2/2026");
    }
    
    // Check all ARA gangs in PR_GANGLN_ARC for 2/2026
    console.log("\n--- All ARA gangs in PR_GANGLN_ARC (2/2026) ---");
    const araGangsArc = await db.query<any>(`
        SELECT 
            RTRIM(g.GangID) as gang_id,
            RTRIM(g.Description) as gang_desc,
            COUNT(DISTINCT RTRIM(gl.EmpCode)) as emp_count
        FROM PR_GANGLN_ARC gl
        INNER JOIN PR_GANG g ON g.ID = gl.MasterID
        WHERE gl.AccMonth = 2 AND gl.AccYear = 2026
        GROUP BY RTRIM(g.GangID), RTRIM(g.Description)
        HAVING RTRIM(g.GangID) LIKE 'F%' 
           OR UPPER(RTRIM(g.Description)) LIKE '%ARA%'
           OR UPPER(RTRIM(g.Description)) LIKE '%BUKIT PANJANG%'
           OR UPPER(RTRIM(g.Description)) LIKE '%PADANG PANJANG%'
        ORDER BY RTRIM(g.GangID)
    `);
    
    console.log(`Found ${araGangsArc.length} ARA-related gangs in PR_GANGLN_ARC:\n`);
    araGangsArc.forEach(row => {
        console.log(`  ${row.gang_id} - ${row.gang_desc}: ${row.emp_count} employees`);
    });
    
    // Check if the accounting period conversion is correct
    console.log("\n--- Accounting Period Check ---");
    console.log("For calendar month 2/2026, what is the AccMonth/AccYear?");
    console.log("According to currentPeriodService, calendar 2/2026 should map to AccMonth 2/2026");
    
    // Check if there's data with different AccMonth
    console.log("\n--- ARA gangs with ANY AccMonth/AccYear near 2/2026 ---");
    const araGangsNear = await db.query<any>(`
        SELECT 
            RTRIM(g.GangID) as gang_id,
            RTRIM(g.Description) as gang_desc,
            gl.AccMonth,
            gl.AccYear,
            COUNT(DISTINCT RTRIM(gl.EmpCode)) as emp_count
        FROM PR_GANGLN_ARC gl
        INNER JOIN PR_GANG g ON g.ID = gl.MasterID
        WHERE gl.AccYear = 2026 AND gl.AccMonth IN (1, 2, 3)
        GROUP BY RTRIM(g.GangID), RTRIM(g.Description), gl.AccMonth, gl.AccYear
        HAVING RTRIM(g.GangID) IN ('F1BHL', 'F2', 'F1H', 'F2H')
        ORDER BY gl.AccYear, gl.AccMonth, RTRIM(g.GangID)
    `);
    
    console.log(`\nFound ${araGangsNear.length} records:\n`);
    araGangsNear.forEach(row => {
        console.log(`  ${row.gang_id} - Acc ${row.accMonth}/${row.accYear}: ${row.emp_count} employees`);
    });
    
    console.log("\n=== CHECK COMPLETE ===");
}

checkHistoricalGangs().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
