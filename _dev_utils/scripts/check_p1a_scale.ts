/**
 * Check P1A scale - how many employees & gangs
 */

import { Database } from './src/db/client';

async function checkP1A() {
    const db = Database.getInstance();

    console.log('=== P1A Scale Analysis ===\n');

    // 1. Count gangs
    const gangCount = await db.query(`
        SELECT COUNT(DISTINCT GangCode) as gang_count
        FROM HR_GANG
        WHERE LocCode IN ('P1A', 'PG1A')
    `);
    console.log('1. Gang count:', gangCount[0]);

    // 2. List gangs
    const gangs = await db.query(`
        SELECT GangCode, Description
        FROM HR_GANG
        WHERE LocCode IN ('P1A', 'PG1A')
        ORDER BY GangCode
    `);
    console.log('\n2. Gangs:');
    gangs.forEach((g: any) => console.log(`   ${g.GangCode} - ${g.Description}`));

    // 3. Count employees
    const empCount = await db.query(`
        SELECT COUNT(DISTINCT gl.GangMember) as emp_count
        FROM HR_GANGLN gl
        JOIN HR_GANG g ON gl.GangCode = g.GangCode
        WHERE g.LocCode IN ('P1A', 'PG1A')
    `);
    console.log('\n3. Employee count:', empCount[0]);

    // 4. Estimate transaction rows for March 2026
    const startDate = '2026-03-01';
    const endDate = '2026-04-01';

    const taskregEstimate = await db.query(`
        SELECT COUNT(*) as taskreg_rows
        FROM PR_TASKREGLN trl
        JOIN HR_GANGLN gl ON trl.EmpCode = gl.GangMember
        JOIN HR_GANG g ON gl.GangCode = g.GangCode
        WHERE g.LocCode IN ('P1A', 'PG1A')
          AND trl.TrxDate >= '${startDate}' AND trl.TrxDate < '${endDate}'
    `);
    console.log('\n4. Taskreg rows (March 2026):', taskregEstimate[0]);

    const adtransEstimate = await db.query(`
        SELECT COUNT(*) as adtrans_rows
        FROM PR_ADTRANSLN ln
        JOIN PR_ADTRANS t ON t.ID = ln.MasterID
        JOIN HR_GANGLN gl ON t.EmpCode = gl.GangMember
        JOIN HR_GANG g ON gl.GangCode = g.GangCode
        WHERE g.LocCode IN ('P1A', 'PG1A')
          AND t.DocDate >= '${startDate}' AND t.DocDate < '${endDate}'
    `);
    console.log('\n5. ADTrans rows (March 2026):', adtransEstimate[0]);

    const totalRows = (taskregEstimate[0] as any).taskreg_rows + (adtransEstimate[0] as any).adtrans_rows;
    console.log(`\n6. TOTAL transaction rows: ~${totalRows.toLocaleString()}`);
    console.log(`   This will take ${(totalRows / 1000).toFixed(0)}s to seed at 1000 rows/sec`);
}

checkP1A();
