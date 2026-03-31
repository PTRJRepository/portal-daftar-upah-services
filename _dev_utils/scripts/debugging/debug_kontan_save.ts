/**
 * Debug Script: Check KONTAN directly in database
 * Run: cd backend && bun run src/scripts/debug_kontan_save.ts
 */
import { Database } from "../db/client";

const TEST_NIK = 'B0065';  // NIK yang baru disave
const TEST_GANG = 'B2N';
const TEST_MONTH = 3;
const TEST_YEAR = 2026;

async function main() {
    const db = Database.getExtendedInstance();

    console.log('=== DEBUG KONTAN SAVE ===');
    console.log(`Checking NIK: ${TEST_NIK}, Period: ${TEST_MONTH}/${TEST_YEAR}`);
    console.log('');

    // 1. Check by NIK (what we saved)
    console.log('[1] Checking by NIK...');
    const byNik = await db.query(`
        SELECT id, nik, emp_code, income_type, income_name, amount, is_paid_in_thp, is_taxable, gang_code, division_code, period_month, period_year
        FROM dbo.employee_other_incomes
        WHERE nik = ? AND period_month = ? AND period_year = ? AND income_type = 'KONTAN'
    `, [TEST_NIK, TEST_MONTH, TEST_YEAR]);

    if (byNik.length > 0) {
        console.log(`  ✅ Found ${byNik.length} record(s) by NIK:`);
        byNik.forEach((r: any) => {
            console.log(`     id=${r.id}, nik=${r.nik}, emp_code=${r.emp_code}, amount=${r.amount}, gang=${r.gang_code}`);
        });
    } else {
        console.log('  ❌ NOT found by NIK');
    }
    console.log('');

    // 2. Check by EMP_CODE (what we also saved)
    console.log('[2] Checking by EMP_CODE...');
    const byEmpCode = await db.query(`
        SELECT id, nik, emp_code, income_type, income_name, amount, is_paid_in_thp, is_taxable, gang_code, division_code
        FROM dbo.employee_other_incomes
        WHERE emp_code = ? AND period_month = ? AND period_year = ? AND income_type = 'KONTAN'
    `, [TEST_NIK, TEST_MONTH, TEST_YEAR]);

    if (byEmpCode.length > 0) {
        console.log(`  ✅ Found ${byEmpCode.length} record(s) by EMP_CODE:`);
        byEmpCode.forEach((r: any) => {
            console.log(`     id=${r.id}, nik=${r.nik}, emp_code=${r.emp_code}, amount=${r.amount}`);
        });
    } else {
        console.log('  ❌ NOT found by EMP_CODE');
    }
    console.log('');

    // 3. Show ALL KONTAN records for this period
    console.log('[3] All KONTAN records for this period...');
    const allKontan = await db.query(`
        SELECT TOP 20 id, nik, emp_code, income_type, income_name, amount, is_paid_in_thp, is_taxable, gang_code, period_month, period_year
        FROM dbo.employee_other_incomes
        WHERE period_month = ? AND period_year = ? AND income_type = 'KONTAN'
        ORDER BY id DESC
    `, [TEST_MONTH, TEST_YEAR]);

    console.log(`  Total KONTAN records: ${allKontan.length}`);
    if (allKontan.length > 0) {
        console.log('  Last 5:');
        allKontan.slice(0, 5).forEach((r: any) => {
            console.log(`     id=${r.id}, nik=${r.nik}, emp_code=${r.emp_code}, amount=${r.amount}, gang=${r.gang_code}`);
        });
    }
    console.log('');

    // 4. Check if data extractor will find it
    console.log('[4] Simulating data extractor lookup...');
    // The extractor uses: nik (uppercase), emp_code (uppercase)
    const nikUpper = TEST_NIK.toUpperCase().trim();
    const empCodeUpper = TEST_NIK.toUpperCase().trim();

    const lookupByNik = await db.query(`
        SELECT * FROM dbo.employee_other_incomes
        WHERE nik = ? AND period_month = ? AND period_year = ? AND income_type = 'KONTAN'
    `, [nikUpper, TEST_MONTH, TEST_YEAR]);

    const lookupByEmpCode = await db.query(`
        SELECT * FROM dbo.employee_other_incomes
        WHERE emp_code = ? AND period_month = ? AND period_year = ? AND income_type = 'KONTAN'
    `, [empCodeUpper, TEST_MONTH, TEST_YEAR]);

    console.log(`  Lookup by nik '${nikUpper}': ${lookupByNik.length} record(s)`);
    console.log(`  Lookup by emp_code '${empCodeUpper}': ${lookupByEmpCode.length} record(s)`);

    if (lookupByNik.length > 0) {
        const r = lookupByNik[0] as any;
        console.log(`  ✅ KONTAN will be found! amount=${r.amount}`);
    } else if (lookupByEmpCode.length > 0) {
        const r = lookupByEmpCode[0] as any;
        console.log(`  ✅ KONTAN will be found via emp_code! amount=${r.amount}`);
    } else {
        console.log('  ❌ KONTAN NOT found by either NIK or EMP_CODE');
        console.log('  This explains why the value disappears after refresh!');
    }

    console.log('\n=== DONE ===');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
