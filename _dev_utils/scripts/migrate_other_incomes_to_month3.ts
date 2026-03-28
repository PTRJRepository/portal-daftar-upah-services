// Script to migrate other incomes from month 2 to month 3 for 2026
import { Database } from '../../backend/src/db/client';

async function main() {
    console.log('=== Migrating Other Incomes: Month 2 -> Month 3 for 2026 ===\n');

    const db = Database.getExtendedInstance();

    // 1. Check current counts
    console.log('--- Step 1: Checking current data ---');
    const countFeb = await db.query<any>(
        'SELECT COUNT(*) as cnt FROM employee_other_incomes WHERE period_year = 2026 AND period_month = 2'
    );
    const countMar = await db.query<any>(
        'SELECT COUNT(*) as cnt FROM employee_other_incomes WHERE period_year = 2026 AND period_month = 3'
    );
    console.log(`Records in Feb 2026: ${countFeb[0]?.cnt || 0}`);
    console.log(`Records in Mar 2026: ${countMar[0]?.cnt || 0}`);

    // 2. Delete existing month 3 records (if any)
    console.log('\n--- Step 2: Cleaning up existing month 3 data ---');
    const deletedMar = await db.query<any>(
        'DELETE FROM employee_other_incomes WHERE period_year = 2026 AND period_month = 3'
    );
    console.log(`Deleted ${deletedMar.length || 0} existing month 3 records`);

    // 3. Migrate month 2 to month 3
    console.log('\n--- Step 3: Migrating month 2 -> month 3 ---');
    const result = await db.query<any>(`
        UPDATE employee_other_incomes
        SET period_month = 3, updated_at = GETDATE()
        WHERE period_year = 2026 AND period_month = 2
    `);
    console.log(`Updated ${result.length || 0} records`);

    // 4. Verify
    console.log('\n--- Step 4: Verification ---');
    const newCountFeb = await db.query<any>(
        'SELECT COUNT(*) as cnt FROM employee_other_incomes WHERE period_year = 2026 AND period_month = 2'
    );
    const newCountMar = await db.query<any>(
        'SELECT COUNT(*) as cnt FROM employee_other_incomes WHERE period_year = 2026 AND period_month = 3'
    );
    console.log(`Records in Feb 2026 (should be 0): ${newCountFeb[0]?.cnt || 0}`);
    console.log(`Records in Mar 2026 (should be ${countFeb[0]?.cnt}): ${newCountMar[0]?.cnt || 0}`);

    // 5. Sample data check
    console.log('\n--- Step 5: Sample migrated data ---');
    const sample = await db.query<any>(`
        SELECT TOP 3 nik, emp_name, income_type, income_name, amount, period_month
        FROM employee_other_incomes
        WHERE period_year = 2026 AND period_month = 3
    `);
    console.log(JSON.stringify(sample, null, 2));

    console.log('\n=== Migration Complete ===');
}

main().catch(console.error);
