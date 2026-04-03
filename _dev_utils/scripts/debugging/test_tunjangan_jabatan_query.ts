/**
 * Debug script to test tunjangan jabatan query against PR_ADTRANS
 * Run: cd backend && bun run ../../_dev_utils/scripts/debugging/test_tunjangan_jabatan_query.ts
 */

import { Database } from "../../../backend/src/db/client";

async function testTunjanganJabatan() {
    const db = Database.getInstance();
    const dbExt = Database.getExtendedInstance();

    // Test parameters
    const division = 'AB1';
    const month = 3;
    const year = 2026;

    // Calculate date range
    const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`;

    console.log(`\n=== Test Period: ${month}/${year} ===`);
    console.log(`Date range: ${startDate} to ${endDate}`);
    console.log(`Division: ${division}\n`);

    // Step 1: Get employees in division (via HR_GANG)
    const employees = await db.query<{ emp_code: string; emp_name: string; gang_code: string }>(`
        SELECT RTRIM(e.EmpCode) as emp_code, MAX(e.EmpName) as emp_name, RTRIM(gl.GangCode) as gang_code
        FROM HR_EMPLOYEE e
        INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        INNER JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        WHERE UPPER(RTRIM(g.LocCode)) = ?
        GROUP BY RTRIM(e.EmpCode), RTRIM(gl.GangCode)
        ORDER BY RTRIM(gl.GangCode), RTRIM(e.EmpCode)
    `, [division]);

    console.log(`Step 1: Found ${employees.length} employees in division ${division}`);
    if (employees.length === 0) {
        console.log("No employees found! Check division code.");
        return;
    }

    const empCodes = employees.map(e => e.emp_code);
    const empList = empCodes.map(e => `'${e}'`).join(",");
    const sampleEmp = empCodes.slice(0, 3);
    const sampleEmpList = sampleEmp.map(e => `'${e}'`).join(",");

    console.log(`\n--- Sample employees: ${sampleEmpList} ---\n`);

    // Step 2: Check ALL DocDesc values in PR_ADTRANS_ARC (any)
    console.log("Step 2: All unique DocDesc containing 'TUNJANGAN' in PR_ADTRANS_ARC:");
    const allTunjangan = await db.query<{ doc_desc: string; count: number }>(`
        SELECT t.DocDesc as doc_desc, COUNT(*) as count
        FROM PR_ADTRANS_ARC t
        WHERE t.DocDate >= ? AND t.DocDate < ?
          AND UPPER(t.DocDesc) LIKE '%TUNJANGAN%'
        GROUP BY t.DocDesc
        ORDER BY t.DocDesc
    `, [startDate, endDate]);
    console.log(`Found ${allTunjangan.length} unique DocDesc:`);
    for (const r of allTunjangan) {
        console.log(`  - "${r.doc_desc}" (${r.count} records)`);
    }

    // Step 3: Check DocDesc = 'TUNJANGAN JABATAN' directly
    console.log("\nStep 3: Checking DocDesc = 'TUNJANGAN JABATAN':");
    const jabatanDirect = await db.query<{ emp_code: string; emp_name: string; doc_desc: string; total: number }>(`
        SELECT TOP 10
            t.EmpCode as emp_code,
            e.EmpName as emp_name,
            t.DocDesc as doc_desc,
            ln.Amount as total
        FROM PR_ADTRANS_ARC t
        JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
        LEFT JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(t.EmpCode)
        WHERE t.DocDate >= ? AND t.DocDate < ?
          AND t.DocDesc = 'TUNJANGAN JABATAN'
        ORDER BY t.EmpCode
    `, [startDate, endDate]);
    console.log(`Found ${jabatanDirect.length} rows with DocDesc = 'TUNJANGAN JABATAN'`);
    for (const r of jabatanDirect.slice(0, 5)) {
        console.log(`  - ${r.emp_code} (${r.emp_name}): ${r.total}`);
    }

    // Step 4: Check LIKE '%JABATAN%' pattern (what the code uses)
    console.log("\nStep 4: Checking UPPER(DocDesc) LIKE '%JABATAN%' (what code uses):");
    const jabatanLike = await db.query<{ emp_code: string; total: number }>(`
        SELECT RTRIM(t.EmpCode) as emp_code, SUM(ln.Amount) as total
        FROM PR_ADTRANS_ARC t
        JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
        WHERE RTRIM(t.EmpCode) IN (${empList})
          AND t.DocDate >= ? AND t.DocDate < ?
          AND UPPER(t.DocDesc) LIKE '%JABATAN%'
          AND ln.Amount > 0
        GROUP BY RTRIM(t.EmpCode)
        ORDER BY RTRIM(t.EmpCode)
    `, [startDate, endDate]);
    console.log(`Found ${jabatanLike.length} employees with 'JABATAN' in DocDesc`);
    for (const r of jabatanLike.slice(0, 10)) {
        console.log(`  - ${r.emp_code}: ${r.total}`);
    }

    // Step 5: Check PR_ADTRANS (base table, not ARC)
    console.log("\nStep 5: Checking PR_ADTRANS base table for 'JABATAN':");
    const jabatanBase = await db.query<{ emp_code: string; total: number }>(`
        SELECT RTRIM(t.EmpCode) as emp_code, SUM(ln.Amount) as total
        FROM PR_ADTRANS t
        JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        WHERE RTRIM(t.EmpCode) IN (${empList})
          AND t.DocDate >= ? AND t.DocDate < ?
          AND UPPER(t.DocDesc) LIKE '%JABATAN%'
          AND ln.Amount > 0
        GROUP BY RTRIM(t.EmpCode)
        ORDER BY RTRIM(t.EmpCode)
    `, [startDate, endDate]);
    console.log(`Found ${jabatanBase.length} employees in PR_ADTRANS base table`);
    for (const r of jabatanBase.slice(0, 10)) {
        console.log(`  - ${r.emp_code}: ${r.total}`);
    }

    // Step 6: Combined (base + ARC)
    console.log("\nStep 6: Combined PR_ADTRANS + PR_ADTRANS_ARC (what getTunjanganAmount does):");
    const jabatanCombined = await db.query<{ emp_code: string; total: number }>(`
        SELECT RTRIM(EmpCode) as emp_code, SUM(Amount) as total
        FROM (
            SELECT t.EmpCode, ln.Amount
            FROM PR_ADTRANS t
            JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
            WHERE RTRIM(t.EmpCode) IN (${empList})
              AND t.DocDate >= ? AND t.DocDate < ?
              AND UPPER(t.DocDesc) LIKE '%JABATAN%'
              AND ln.Amount > 0

            UNION ALL

            SELECT t.EmpCode, ln.Amount
            FROM PR_ADTRANS_ARC t
            JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
            WHERE RTRIM(t.EmpCode) IN (${empList})
              AND t.DocDate >= ? AND t.DocDate < ?
              AND UPPER(t.DocDesc) LIKE '%JABATAN%'
              AND ln.Amount > 0
        ) combined
        GROUP BY RTRIM(EmpCode)
    `, [startDate, endDate, startDate, endDate]);
    console.log(`Found ${jabatanCombined.length} employees (combined)`);
    for (const r of jabatanCombined.slice(0, 10)) {
        console.log(`  - ${r.emp_code}: ${r.total}`);
    }

    // Step 7: Compare with the SIMPLER approach (no join, just from PR_ADTRANS_ARC)
    console.log("\nStep 7: Simple SUM without JOIN (PR_ADTRANS_ARC only, DocDesc = exact match):");
    const jabatanSimple = await db.query<{ emp_code: string; emp_name: string; total: number }>(`
        SELECT TOP 10
            t.EmpCode as emp_code,
            e.EmpName as emp_name,
            SUM(ln.Amount) as total
        FROM PR_ADTRANS_ARC t
        JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
        LEFT JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(t.EmpCode)
        WHERE t.EmpCode IN (${sampleEmpList})
          AND t.DocDate >= ? AND t.DocDate < ?
          AND t.DocDesc = 'TUNJANGAN JABATAN'
        GROUP BY t.EmpCode, e.EmpName
        ORDER BY t.EmpCode
    `, [startDate, endDate]);
    console.log(`Simple query results (first 10):`);
    for (const r of jabatanSimple) {
        console.log(`  - ${r.emp_code} (${r.emp_name}): ${r.total}`);
    }

    // Step 8: Check if DocDesc has different casing
    console.log("\nStep 8: Check for alternative casing patterns:");
    const altPatterns = ['TUNJANGAN JABATAN', 'tunjangan jabatan', 'Tunjangan Jabatan', 'TUNJANGANJABATAN'];
    for (const pattern of altPatterns) {
        const count = await db.query<{ c: number }>(`
            SELECT COUNT(*) as c
            FROM PR_ADTRANS_ARC t
            WHERE t.DocDate >= ? AND t.DocDate < ?
              AND t.DocDesc = ?
        `, [startDate, endDate, pattern]);
        console.log(`  DocDesc = '${pattern}': ${count[0]?.c || 0} records`);
    }

    console.log("\n=== END OF TEST ===\n");
}

testTunjanganJabatan()
    .catch(console.error)
    .finally(() => process.exit());
