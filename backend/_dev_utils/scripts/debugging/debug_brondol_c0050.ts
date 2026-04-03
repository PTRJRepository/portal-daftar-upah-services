/**
 * Debug Script: Full investigation of C0050 brondol discrepancy
 * Run: cd backend && bun run _dev_utils/scripts/debugging/debug_brondol_c0050.ts
 */
import { Database } from "../../../src/db/client";

const EMP_CODE = 'C0050';
const START_DATE = '2026-03-01';
const END_DATE = '2026-04-01';

async function main() {
    const db = Database.getInstance();
    const dbExt = Database.getExtendedInstance();

    console.log('=== SUMMARY: C0050 Brondol for March 2026 ===\n');

    // 1. PR_LOOSEFRUIT - active table
    console.log('1. PR_LOOSEFRUIT (active):');
    try {
        const rows = await db.query(`
            SELECT SUM(Amount) as total
            FROM PR_LOOSEFRUIT LF
            JOIN PR_LOOSEFRUITLN LFLN ON LF.ID = LFLN.MasterID
            WHERE RTRIM(LFLN.EmpCode) = ? AND LF.DocDate >= ? AND LF.DocDate < ?
        `, [EMP_CODE, START_DATE, END_DATE]);
        console.log(`   Amount total: ${rows[0]?.total || 0}`);
    } catch (e) { console.log(`   Error: ${e.message}`); }

    // 2. PR_LOOSEFRUIT_ARC - archived table
    console.log('\n2. PR_LOOSEFRUIT_ARC (archived):');
    try {
        const rows = await db.query(`
            SELECT SUM(Amount) as total
            FROM PR_LOOSEFRUIT_ARC LF
            JOIN PR_LOOSEFRUITLN_ARC LFLN ON LF.ID = LFLN.MasterID
            WHERE RTRIM(LFLN.EmpCode) = ? AND LF.DocDate >= ? AND LF.DocDate < ?
        `, [EMP_CODE, START_DATE, END_DATE]);
        console.log(`   Amount total: ${rows[0]?.total || 0}`);
    } catch (e) { console.log(`   Error: ${e.message}`); }

    // 3. PR_ADTRANS - check if there's BRONDOL in adtrans
    console.log('\n3. PR_ADTRANS (DocDesc containing BRONDOL):');
    try {
        const rows = await db.query(`
            SELECT SUM(ln.Amount) as total
            FROM PR_ADTRANS t
            JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
            WHERE RTRIM(t.EmpCode) = ? AND t.DocDate >= ? AND t.DocDate < ?
              AND UPPER(t.DocDesc) LIKE '%BRONDOL%'
        `, [EMP_CODE, START_DATE, END_DATE]);
        console.log(`   Amount total: ${rows[0]?.total || 0}`);
    } catch (e) { console.log(`   Error: ${e.message}`); }

    // 4. PR_ADTRANS_ARC
    console.log('\n4. PR_ADTRANS_ARC (DocDesc containing BRONDOL):');
    try {
        const rows = await db.query(`
            SELECT SUM(ln.Amount) as total
            FROM PR_ADTRANS_ARC t
            JOIN PR_ADTRANSLN_ARC ln ON t.ID = ln.MasterID
            WHERE RTRIM(t.EmpCode) = ? AND t.DocDate >= ? AND t.DocDate < ?
              AND UPPER(t.DocDesc) LIKE '%BRONDOL%'
        `, [EMP_CODE, START_DATE, END_DATE]);
        console.log(`   Amount total: ${rows[0]?.total || 0}`);
    } catch (e) { console.log(`   Error: ${e.message}`); }

    // 5. Check aggregation table
    console.log('\n5. Aggregation table (extend_db_ptrj) for C0050:');
    try {
        const rows = await dbExt.query(`
            SELECT TOP 5 h.period_month, h.period_year, d.emp_code, d.premi_brondol, d.total_premi
            FROM dbo.payroll_history_detail d
            JOIN dbo.payroll_history_master h ON d.master_id = h.id
            WHERE d.emp_code = 'C0050'
            ORDER BY h.period_year DESC, h.period_month DESC
        `, []);
        console.log(`   Found ${rows.length} records:`);
        for (const r of rows as any[]) {
            console.log(`   ${r.period_month}/${r.period_year} | emp='${r.emp_code}' | premi_brondol=${r.premi_brondol} | total_premi=${r.total_premi}`);
        }
        if (rows.length === 0) console.log('   (no records for C0050)');
    } catch (e) { console.log(`   Error: ${e.message}`); }

    // 6. HR_GANG for C1H - what division?
    console.log('\n6. HR_GANG for C1H:');
    try {
        const rows = await db.query(`SELECT TOP 5 GangCode, LocCode FROM HR_GANG WHERE RTRIM(GangCode) = 'C1H'`, []);
        for (const r of rows as any[]) {
            console.log(`   GangCode='${r.GangCode}' | LocCode='${r.LocCode}'`);
        }
    } catch (e) { console.log(`   Error: ${e.message}`); }

    // 7. Check ALL DocDesc for C0050 in the period
    console.log('\n7. ALL DocDesc for C0050 (active, March 2026):');
    try {
        const rows = await db.query(`
            SELECT t.DocDesc, SUM(ln.Amount) as total
            FROM PR_ADTRANS t
            JOIN PR_ADTRANSLN ln ON t.ID = ln.MasterID
            WHERE RTRIM(t.EmpCode) = ? AND t.DocDate >= ? AND t.DocDate < ?
            GROUP BY t.DocDesc
            ORDER BY total DESC
        `, [EMP_CODE, START_DATE, END_DATE]);
        console.log(`   Found ${rows.length} DocDesc:`);
        for (const r of rows as any[]) {
            console.log(`   '${r.DocDesc}' | total=${r.total}`);
        }
        if (rows.length === 0) console.log('   (no records)');
    } catch (e) { console.log(`   Error: ${e.message}`); }

    console.log('\n=== ANALYSIS ===');
    console.log('DB (PR_LOOSEFRUIT active): 208.250');
    console.log('DB (PR_LOOSEFRUIT ARC Feb): 183.750');
    console.log('UI shows: 144.688');
    console.log('');
    console.log('Note: PR_LOOSEFRUIT_ARC had February data (183.750) mixed in!');
    console.log('The original debug showed 183.750 from the archive for Feb 2026.');
    console.log('');
    console.log('Remaining discrepancy: 208.250 vs 144.688 = 63.562 difference.');
    console.log('This needs further investigation.');
    console.log('');
    console.log('Also: C0050 is in gang C1H - check what division C1H belongs to.');
    console.log('If the UI query uses PG1A division and C1H is NOT in PG1A,');
    console.log('then C0050 wont appear in the /locked/report/raw-tree?div=PG1A result.');
    console.log('\n=== DONE ===');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
