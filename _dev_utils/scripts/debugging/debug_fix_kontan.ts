/**
 * Final verification: Check table schema and data
 */
import { Database } from "../db/client";

async function main() {
    const dbExt = Database.getExtendedInstance();

    // Check columns
    const cols = await dbExt.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'employee_other_incomes'`);
    console.log('employee_other_incomes columns:', cols.map((c: any) => c.COLUMN_NAME).join(', '));
    console.log('');

    // Show all KONTAN records with all fields
    const rows = await dbExt.query(`
        SELECT * FROM dbo.employee_other_incomes
        WHERE period_month = 3 AND period_year = 2026 AND income_type = 'KONTAN'
        ORDER BY id DESC
    `);

    console.log(`KONTAN records (${rows.length}):`);
    for (const r of rows) {
        console.log(`\n  id=${r.id}:`);
        console.log(`    nik        = '${r.nik}'`);
        console.log(`    emp_code   = '${r.emp_code}'`);
        console.log(`    amount     = ${r.amount}`);
        console.log(`    gang_code  = '${r.gang_code}'`);
        console.log(`    income_type= '${r.income_type}'`);
        console.log(`    income_name= '${r.income_name}'`);
        console.log(`    is_paid_in_thp = ${r.is_paid_in_thp}`);
        console.log(`    is_taxable     = ${r.is_taxable}`);
    }

    // Now simulate data extractor lookup
    console.log('\n\n=== Simulating Data Extractor Lookup ===');
    console.log('Data extractor looks up by: empNik (actual_nik from HR_EMPLOYEE.NewICNo)');
    for (const r of rows) {
        const nikLen = (r.nik || '').length;
        const willFind = nikLen >= 13 && (r.nik || '').match(/^\d/);
        console.log(`  '${r.nik}' (len=${nikLen}): ${willFind ? '✅ WILL BE FOUND' : '❌ NOT FOUND'}`);
    }

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
