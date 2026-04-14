/**
 * DIAGNOSTIC: Trace exactly where F1BHL exists across all tables
 * and why it's being missed in the extraction query
 */
import { Database } from '../../backend/src/db/client';

async function diagnose() {
    const db = Database.getInstance();

    console.log('=== F1BHL DIAGNOSIS ===\n');

    // 1. Check HR_GANG (Master)
    console.log('--- 1. HR_GANG (Master) ---');
    const masterRows = await db.query<any>(`
        SELECT RTRIM(GangCode) as code, RTRIM(Description) as gang_desc, RTRIM(LocCode) as loc 
        FROM HR_GANG 
        WHERE GangCode LIKE '%BHL%' OR Description LIKE '%BHL%'
    `);
    console.table(masterRows);

    // 2. Check HR_GANGLN (Membership) - what columns exist?
    console.log('\n--- 2. HR_GANGLN columns ---');
    const glColumns = await db.query<any>(`SELECT TOP 1 * FROM HR_GANGLN WHERE GangCode LIKE '%BHL%'`);
    if (glColumns.length > 0) {
        console.log('Columns:', Object.keys(glColumns[0]).join(', '));
        console.log('Sample:', glColumns[0]);
    } else {
        console.log('No BHL rows in HR_GANGLN');
    }

    // 3. HR_GANGLN members for BHL gangs
    console.log('\n--- 3. HR_GANGLN members for BHL gangs ---');
    const members = await db.query<any>(`
        SELECT RTRIM(gl.GangCode) as gang, RTRIM(gl.GangMember) as member, RTRIM(e.LocCode) as emp_loc
        FROM HR_GANGLN gl
        JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(gl.GangMember)
        WHERE gl.GangCode LIKE '%BHL%'
    `);
    console.log(`Found ${members.length} BHL members in HR_GANGLN`);
    if (members.length > 0) {
        // Show distinct gangs and their employee LocCodes
        const gangMap: Record<string, string[]> = {};
        for (const m of members) {
            if (!gangMap[m.gang]) gangMap[m.gang] = [];
            if (!gangMap[m.gang].includes(m.emp_loc)) gangMap[m.gang].push(m.emp_loc);
        }
        for (const [gang, locs] of Object.entries(gangMap)) {
            console.log(`  ${gang}: ${members.filter((m: any) => m.gang === gang).length} members, employee LocCodes: [${locs.join(', ')}]`);
        }
    }

    // 4. PR_GANGLN_ARC (Historical) for BHL
    console.log('\n--- 4. PR_GANGLN_ARC (Historical) for BHL ---');
    const histRows = await db.query<any>(`
        SELECT DISTINCT RTRIM(g.GangID) as gang, COUNT(*) as cnt
        FROM PR_GANGLN_ARC gl
        JOIN PR_GANG g ON g.ID = gl.MasterID
        WHERE g.GangID LIKE '%BHL%'
        GROUP BY g.GangID
    `);
    console.table(histRows);

    // 5. What LocCode do F1BHL employees have?
    console.log('\n--- 5. F1BHL employee LocCodes ---');
    const f1bhlEmps = await db.query<any>(`
        SELECT RTRIM(gl.GangCode) as gang, RTRIM(e.EmpCode) as emp, RTRIM(e.LocCode) as loc
        FROM HR_GANGLN gl
        JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(gl.GangMember)
        WHERE UPPER(RTRIM(gl.GangCode)) = 'F1BHL'
    `);
    console.log(`F1BHL employees: ${f1bhlEmps.length}`);
    console.table(f1bhlEmps);

    // 6. Test the actual gangCondition that would be generated for PG1A
    console.log('\n--- 6. Simulating gangCondition for PG1A ALL ---');
    const aliases = ['P1A', 'PG1A'];
    const placeholders = aliases.map(a => `'${a.toUpperCase()}'`).join(',');
    const testCondition = `(UPPER(RTRIM(g.LocCode)) IN (${placeholders}) OR UPPER(RTRIM(e.LocCode)) IN (${placeholders}))`;
    
    const testQuery = `
        SELECT COUNT(*) as cnt, RTRIM(gl.GangCode) as gang
        FROM HR_EMPLOYEE e
        INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        LEFT JOIN HR_GANG g ON gl.GangCode = g.GangCode
        WHERE ${testCondition}
        GROUP BY gl.GangCode
        ORDER BY gl.GangCode
    `;
    console.log('Query condition:', testCondition);
    const testResult = await db.query<any>(testQuery);
    console.log(`Gangs found with LocCode filter: ${testResult.length}`);
    console.table(testResult);

    // 7. Now test WITH F1BHL inclusion
    console.log('\n--- 7. With F1BHL explicit inclusion ---');
    const enhancedCondition = `(${testCondition} OR (UPPER(RTRIM(gl.GangCode)) LIKE '%BHL%'))`;
    const enhancedQuery = `
        SELECT COUNT(*) as cnt, RTRIM(gl.GangCode) as gang
        FROM HR_EMPLOYEE e
        INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        LEFT JOIN HR_GANG g ON gl.GangCode = g.GangCode
        WHERE ${enhancedCondition}
        GROUP BY gl.GangCode
        ORDER BY gl.GangCode
    `;
    const enhancedResult = await db.query<any>(enhancedQuery);
    console.log(`Gangs found with BHL inclusion: ${enhancedResult.length}`);
    console.table(enhancedResult);

    process.exit(0);
}

diagnose().catch(err => { console.error(err); process.exit(1); });
