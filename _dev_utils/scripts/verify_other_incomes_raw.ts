// Simple verification of other incomes data for March 2026
import { Database } from '../../backend/src/db/client';

async function main() {
    console.log('=== Verifying Other Incomes for March 2026 (Raw Data) ===\n');

    const db = Database.getExtendedInstance();

    // Check records
    const records = await db.query<any>(`
        SELECT period_year, period_month, COUNT(*) as cnt,
               SUM(CASE WHEN is_paid_in_thp = 1 THEN amount ELSE 0 END) as total_thp,
               SUM(CASE WHEN is_taxable = 1 THEN amount ELSE 0 END) as total_taxable
        FROM employee_other_incomes
        WHERE period_year = 2026
        GROUP BY period_year, period_month
        ORDER BY period_month
    `);

    console.log('Records by month:');
    for (const r of records) {
        console.log(`  Month ${r.period_month} 2026: ${r.cnt} records, THP: Rp ${Number(r.total_thp).toLocaleString()}, Taxable: Rp ${Number(r.total_taxable).toLocaleString()}`);
    }

    // Sample record
    console.log('\n--- Sample Record ---');
    const sample = await db.query<any>(`
        SELECT TOP 3 nik, emp_name, income_type, income_name, amount, is_paid_in_thp, is_taxable
        FROM employee_other_incomes
        WHERE period_year = 2026 AND period_month = 3
    `);
    console.log(JSON.stringify(sample, null, 2));
}

main().catch(console.error);
