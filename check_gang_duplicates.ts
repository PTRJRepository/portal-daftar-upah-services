/**
 * Check for duplicate employees in gang data
 * Focus on F1BHL, WKS_PG, and probationary employees (BHL, P codes)
 */
import { Database } from "./backend/src/db/client";

async function checkDuplicates() {
    console.log("=== CHECKING EMPLOYEE DUPLICATES ===\n");
    
    const db = Database.getInstance();
    
    // Check 1: F1BHL gang employees
    console.log("--- Check 1: F1BHL Gang Employees ---");
    const f1bhlRows = await db.query<any>(`
        SELECT 
            RTRIM(gl.GangMember) as emp_code,
            RTRIM(e.EmpName) as emp_name,
            RTRIM(g.GangCode) as gang_code,
            RTRIM(g.Description) as gang_desc,
            COUNT(*) as occurrence_count
        FROM HR_GANGLN gl
        INNER JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        INNER JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(gl.GangMember)
        WHERE UPPER(RTRIM(gl.GangCode)) = 'F1BHL'
           OR UPPER(RTRIM(g.Description)) = 'F1BHL'
        GROUP BY RTRIM(gl.GangMember), RTRIM(e.EmpName), RTRIM(g.GangCode), RTRIM(g.Description)
        HAVING COUNT(*) > 1
        ORDER BY occurrence_count DESC
    `);
    
    if (f1bhlRows.length > 0) {
        console.log(`⚠️ Found ${f1bhlRows.length} F1BHL employees with duplicates:`);
        f1bhlRows.forEach(row => {
            console.log(`  ${row.emp_code} - ${row.emp_name}: ${row.occurrence_count} occurrences`);
        });
    } else {
        console.log("✅ No duplicates found in F1BHL gang\n");
    }
    
    // Check 2: All F-prefix gangs (ARA division) for duplicates
    console.log("\n--- Check 2: All ARA Division Gangs (F-prefix) ---");
    const araDups = await db.query<any>(`
        SELECT 
            RTRIM(gl.GangMember) as emp_code,
            RTRIM(e.EmpName) as emp_name,
            RTRIM(gl.GangCode) as gang_code,
            COUNT(*) as occurrence_count
        FROM HR_GANGLN gl
        INNER JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(gl.GangMember)
        WHERE gl.GangCode LIKE 'F%'
        GROUP BY RTRIM(gl.GangMember), RTRIM(e.EmpName), RTRIM(gl.GangCode)
        HAVING COUNT(*) > 1
        ORDER BY gang_code, occurrence_count DESC
    `);
    
    if (araDups.length > 0) {
        console.log(`⚠️ Found ${araDups.length} duplicate entries in ARA division:`);
        araDups.slice(0, 20).forEach(row => {
            console.log(`  ${row.emp_code} - ${row.emp_name} in ${row.gang_code}: ${row.occurrence_count} occurrences`);
        });
        if (araDups.length > 20) {
            console.log(`  ... and ${araDups.length - 20} more`);
        }
    } else {
        console.log("✅ No duplicates found in ARA division\n");
    }
    
    // Check 3: Employees appearing in MULTIPLE gangs (cross-gang duplication)
    console.log("\n--- Check 3: Employees in Multiple Gangs ---");
    const multiGangEmps = await db.query<any>(`
        SELECT 
            emp_code,
            emp_name,
            gang_count,
            gang_list
        FROM (
            SELECT 
                RTRIM(gl.GangMember) as emp_code,
                RTRIM(e.EmpName) as emp_name,
                COUNT(DISTINCT gl.GangCode) as gang_count,
                STRING_AGG(RTRIM(gl.GangCode), ', ') within group (order by gl.GangCode) as gang_list
            FROM HR_GANGLN gl
            INNER JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(gl.GangMember)
            WHERE gl.GangCode LIKE 'F%'
            GROUP BY RTRIM(gl.GangMember), RTRIM(e.EmpName)
        ) sub
        WHERE gang_count > 1
        ORDER BY gang_count DESC, emp_code
    `);
    
    if (multiGangEmps.length > 0) {
        console.log(`⚠️ Found ${multiGangEmps.length} employees appearing in multiple F-prefix gangs:`);
        multiGangEmps.slice(0, 20).forEach(row => {
            console.log(`  ${row.emp_code} - ${row.emp_name}: in ${row.gang_count} gangs [${row.gang_list}]`);
        });
        if (multiGangEmps.length > 20) {
            console.log(`  ... and ${multiGangEmps.length - 20} more`);
        }
    } else {
        console.log("✅ No cross-gang duplication found\n");
    }
    
    // Check 4: WKS_PG (AMC gang) employees
    console.log("\n--- Check 4: WKS_PG (AMC Gang) Employees ---");
    const wksPgRows = await db.query<any>(`
        SELECT 
            RTRIM(gl.GangMember) as emp_code,
            RTRIM(e.EmpName) as emp_name,
            RTRIM(g.GangCode) as gang_code,
            RTRIM(g.Description) as gang_desc,
            COUNT(*) as occurrence_count
        FROM HR_GANGLN gl
        INNER JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        INNER JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(gl.GangMember)
        WHERE UPPER(RTRIM(gl.GangCode)) = 'AMC'
           OR UPPER(RTRIM(g.Description)) LIKE '%AMC%'
        GROUP BY RTRIM(gl.GangMember), RTRIM(e.EmpName), RTRIM(g.GangCode), RTRIM(g.Description)
        HAVING COUNT(*) > 1
        ORDER BY occurrence_count DESC
    `);
    
    if (wksPgRows.length > 0) {
        console.log(`⚠️ Found ${wksPgRows.length} WKS_PG/AMC employees with duplicates:`);
        wksPgRows.forEach(row => {
            console.log(`  ${row.emp_code} - ${row.emp_name} in ${row.gang_code}: ${row.occurrence_count} occurrences`);
        });
    } else {
        console.log("✅ No duplicates found in WKS_PG/AMC gang\n");
    }
    
    // Check 5: Probationary employees (BHL or P-code gangs)
    console.log("\n--- Check 5: Probationary Employees (BHL/P-code) ---");
    const probDups = await db.query<any>(`
        SELECT 
            RTRIM(gl.GangMember) as emp_code,
            RTRIM(e.EmpName) as emp_name,
            RTRIM(gl.GangCode) as gang_code,
            COUNT(*) as occurrence_count
        FROM HR_GANGLN gl
        INNER JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(gl.GangMember)
        WHERE gl.GangCode LIKE '%BHL%'
           OR gl.GangCode LIKE 'P%'
           AND gl.GangCode NOT LIKE 'PG%'  -- Exclude PG1A, PG1B, etc.
           AND gl.GangCode NOT LIKE 'P1%'  -- Exclude P1A, P1B
           AND gl.GangCode NOT LIKE 'P2%'  -- Exclude P2A, P2B
        GROUP BY RTRIM(gl.GangMember), RTRIM(e.EmpName), RTRIM(gl.GangCode)
        HAVING COUNT(*) > 1
        ORDER BY gang_code, occurrence_count DESC
    `);
    
    if (probDups.length > 0) {
        console.log(`⚠️ Found ${probDups.length} probationary employee duplicates:`);
        probDups.slice(0, 20).forEach(row => {
            console.log(`  ${row.emp_code} - ${row.emp_name} in ${row.gang_code}: ${row.occurrence_count} occurrences`);
        });
        if (probDups.length > 20) {
            console.log(`  ... and ${probDups.length - 20} more`);
        }
    } else {
        console.log("✅ No duplicates found in probationary gangs\n");
    }
    
    // Check 6: Look for employees in HR_GANGLN with duplicate gang assignments
    console.log("\n--- Check 6: Duplicate Gang Assignments in HR_GANGLN ---");
    const dupAssignments = await db.query<any>(`
        SELECT 
            RTRIM(GangMember) as emp_code,
            RTRIM(GangCode) as gang_code,
            COUNT(*) as dup_count
        FROM HR_GANGLN
        GROUP BY RTRIM(GangMember), RTRIM(GangCode)
        HAVING COUNT(*) > 1
        ORDER BY dup_count DESC
    `);
    
    if (dupAssignments.length > 0) {
        console.log(`⚠️ Found ${dupAssignments.length} duplicate assignments in HR_GANGLN table:`);
        dupAssignments.slice(0, 20).forEach(row => {
            console.log(`  ${row.emp_code} in ${row.gang_code}: ${row.dup_count} duplicate rows`);
        });
        if (dupAssignments.length > 20) {
            console.log(`  ... and ${dupAssignments.length - 20} more`);
        }
    } else {
        console.log("✅ No duplicate assignments in HR_GANGLN\n");
    }
    
    console.log("\n=== CHECK COMPLETE ===");
}

checkDuplicates().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
