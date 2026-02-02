/**
 * Test script to verify that "PREMI TIKET" is NOT included in potongan upah bersih
 * but IS included in premi (tunjangan).
 */

import { Database } from "../src/db/client";

const db = Database.getInstance();

async function testTiketHandling() {
    console.log("=== TEST PREMI TIKET HANDLING ===\n");

    const testEmpCode = "E001"; // Change this to a real employee code
    const testMonth = 1; // January
    const testYear = 2026;
    const startDate = `${testYear}-${testMonth.toString().padStart(2, '0')}-01`;
    const daysInMonth = new Date(testYear, testMonth, 0).getDate();
    const endDate = `${testYear}-${testMonth.toString().padStart(2, '0')}-${daysInMonth}`;

    // 1. Check if "PREMI TIKET" exists in PR_ADTRANS
    console.log("1. Checking for PREMI TIKET in PR_ADTRANS:");
    const tiketRows = await db.query<{
        emp_code: string;
        doc_desc: string;
        amount: number;
    }>(`
        SELECT
            RTRIM(t.EmpCode) as emp_code,
            t.DocDesc as doc_desc,
            SUM(ln.Amount) as amount
        FROM (
            SELECT t.EmpCode, t.ID, t.DocDesc, t.DocDate
            FROM PR_ADTRANS t
            WHERE t.DocDate >= ? AND t.DocDate < ?

            UNION ALL

            SELECT t.EmpCode, t.ID, t.DocDesc, t.DocDate
            FROM PR_ADTRANS_ARC t
            WHERE t.DocDate >= ? AND t.DocDate < ?
        ) t
        JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        WHERE UPPER(t.DocDesc) LIKE '%TIKET%'
        GROUP BY RTRIM(t.EmpCode), t.DocDesc
    `, [startDate, endDate, startDate, endDate]);

    if (tiketRows.length === 0) {
        console.log("   ℹ️  No items with 'TIKET' found in the database for the specified period.");
    } else {
        console.log(`   Found ${tiketRows.length} items with 'TIKET':`);
        for (const row of tiketRows) {
            console.log(`   - ${row.emp_code}: ${row.doc_desc} = Rp ${row.amount.toLocaleString('id-ID')}`);
        }
    }

    // 2. Test potongan query (should NOT include PREMI TIKET after fix)
    console.log("\n2. Testing Potongan Query (should NOT include PREMI TIKET):");
    const potonganRows = await db.query<{
        emp_code: string;
        doc_desc: string;
        amount: number;
    }>(`
        SELECT
            RTRIM(t.EmpCode) as emp_code,
            t.DocDesc as doc_desc,
            SUM(ln.Amount) as amount
        FROM (
            SELECT t.EmpCode, t.ID, t.DocDesc, t.DocDate
            FROM PR_ADTRANS t
            WHERE t.DocDate >= ? AND t.DocDate < ?

            UNION ALL

            SELECT t.EmpCode, t.ID, t.DocDesc, t.DocDate
            FROM PR_ADTRANS_ARC t
            WHERE t.DocDate >= ? AND t.DocDate < ?
        ) t
        JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        WHERE (
            (UPPER(t.DocDesc) LIKE '%PPH%' AND UPPER(t.DocDesc) NOT LIKE '%PREMI%')
            OR UPPER(t.DocDesc) LIKE '%POT%'
            OR UPPER(t.DocDesc) LIKE '%BPJS%'
            OR UPPER(t.DocDesc) LIKE '%PINJAM%'
            OR UPPER(t.DocDesc) LIKE '%KL%'
            OR UPPER(t.DocDesc) LIKE '%SPSI%'
            OR UPPER(t.DocDesc) LIKE '%KOREKSI%'
            OR UPPER(t.DocDesc) LIKE '%TOTAL%'
            -- REMOVED: %TIKET%
            OR UPPER(t.DocDesc) LIKE '%KONTAN%'
            OR UPPER(t.DocDesc) LIKE '%ALAT%'
            OR UPPER(t.DocDesc) LIKE '%THR%'
        )
        GROUP BY RTRIM(t.EmpCode), t.DocDesc
    `, [startDate, endDate, startDate, endDate]);

    const tiketInPotongan = potonganRows.filter(r => r.doc_desc.toUpperCase().includes('TIKET'));
    if (tiketInPotongan.length === 0) {
        console.log("   ✅ GOOD: No 'TIKET' items in potongan query result");
    } else {
        console.log("   ❌ BAD: Found 'TIKET' items in potongan query result:");
        for (const row of tiketInPotongan) {
            console.log(`   - ${row.emp_code}: ${row.doc_desc} = Rp ${row.amount.toLocaleString('id-ID')}`);
        }
    }

    // 3. Test premi query (should include PREMI TIKET)
    console.log("\n3. Testing Premi Query (should include PREMI TIKET if exists):");
    const premiRows = await db.query<{
        emp_code: string;
        doc_desc: string;
        amount: number;
    }>(`
        SELECT
            RTRIM(t.EmpCode) as emp_code,
            t.DocDesc as doc_desc,
            SUM(ln.Amount) as amount
        FROM (
            SELECT t.EmpCode, t.ID, t.DocDesc, t.DocDate
            FROM PR_ADTRANS t
            WHERE t.DocDate >= ? AND t.DocDate < ?

            UNION ALL

            SELECT t.EmpCode, t.ID, t.DocDesc, t.DocDate
            FROM PR_ADTRANS_ARC t
            WHERE t.DocDate >= ? AND t.DocDate < ?
        ) t
        JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
        LEFT JOIN PR_TASKCODE mt ON ln.TaskCode = mt.TaskCode
        WHERE UPPER(t.DocDesc) LIKE '%PREMI%'
          AND UPPER(t.DocDesc) NOT LIKE '%PPH%'
          AND (mt.TaskDesc IS NULL OR mt.TaskDesc <> 'ACCRUALS-CHECKROLL')
          AND ln.Amount > 0
        GROUP BY RTRIM(t.EmpCode), t.DocDesc
    `, [startDate, endDate, startDate, endDate]);

    const tiketInPremi = premiRows.filter(r => r.doc_desc.toUpperCase().includes('TIKET'));
    if (tiketInPremi.length === 0) {
        console.log("   ℹ️  No 'PREMI TIKET' items found (might not exist for this period)");
    } else {
        console.log("   ✅ GOOD: Found 'PREMI TIKET' in premi query:");
        for (const row of tiketInPremi) {
            console.log(`   - ${row.emp_code}: ${row.doc_desc} = Rp ${row.amount.toLocaleString('id-ID')}`);
        }
    }

    console.log("\n=== SUMMARY ===");
    console.log("Expected behavior:");
    console.log("1. 'PREMI TIKET' should NOT be in potongan (potongan upah bersih)");
    console.log("2. 'PREMI TIKET' should be in premi (tunjangan) if it exists");
    console.log("3. 'PREMI PPH' is the ONLY premi that goes to upah_bersih calculation");
}

testTiketHandling().catch(console.error);
