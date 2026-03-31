/**
 * Debug Script: Comprehensive KONTAN trace from save to retrieve
 * Run: cd backend && bun run src/scripts/debug_kontan_trace.ts
 */
import { Database } from "../db/client";
import { Config } from "../config";

const TEST_PERIOD = { month: 3, year: 2026 };

async function main() {
    const dbExt = Database.getExtendedInstance();  // extend_db_ptrj - where employee_other_incomes lives

    console.log('=== KONTAN SAVE TRACE ===\n');

    // Show ALL KONTAN records
    const allKontan = await dbExt.query(`
        SELECT id, nik, emp_code, income_type, income_name, amount, gang_code, period_month, period_year, emp_name
        FROM dbo.employee_other_incomes
        WHERE period_month = ? AND period_year = ? AND income_type = 'KONTAN'
        ORDER BY id DESC
    `, [TEST_PERIOD.month, TEST_PERIOD.year]);

    console.log(`Total KONTAN records for ${TEST_PERIOD.month}/${TEST_PERIOD.year}: ${allKontan.length}`);
    console.log('');

    for (const r of allKontan) {
        const row = r as any;
        const nikLen = (row.nik || '').length;
        const nikLooksLikeEmp = nikLen < 15;
        const empCodeLooksLikeNik = (row.emp_code || '').length >= 13;

        console.log(`[${row.id}] nik='${row.nik}' (len=${nikLen}, ${nikLooksLikeEmp ? '⚠️ like EMP_CODE' : '✅ like real NIK'})`);
        console.log(`       emp_code='${row.emp_code}'`);
        console.log(`       amount=${row.amount}, gang=${row.gang_code}`);
        console.log(`       is_paid_in_thp=${row.is_paid_in_thp}, is_taxable=${row.is_taxable}`);

        // Show what data extractor would find
        if (nikLooksLikeEmp) {
            console.log(`       ⚠️ BUG: nik='${row.nik}' looks like EMP_CODE, not real NIK`);
            console.log(`          Data extractor uses actual_nik (real NIK), will NOT match!`);
        }
        console.log('');
    }

    console.log('=== FIX ANALYSIS ===');
    const badRecords = allKontan.filter((r: any) => {
        const nik = (r.nik || '').trim();
        return nik.length < 13 || !nik.match(/^\d{10,}$/);
    });

    if (badRecords.length > 0) {
        console.log(`❌ Found ${badRecords.length} records with bad nik (looks like emp_code, not real NIK):`);
        badRecords.forEach((r: any) => {
            console.log(`   - id=${r.id}, nik='${r.nik}', amount=${r.amount}`);
        });
        console.log('');
        console.log('These records will NOT be found by data extractor because:');
        console.log('  1. Data extractor uses actual_nik (real KTP NIK, 13+ digits)');
        console.log('  2. These records have emp_code stored in nik field');
        console.log('');
        console.log('FIX: Need to update nik field with real NIK for these records');
        console.log('     The emp_code field already has the emp_code, so we need to look up');
        console.log('     the real NIK via HR_EMPLOYEE table to update the nik field.');
    } else {
        console.log('✅ All records have proper nik values (likely real NIKs)');
    }

    console.log('\n=== DONE ===');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
