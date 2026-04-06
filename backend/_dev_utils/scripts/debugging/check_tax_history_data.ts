/**
 * Debug Script: Check what tax/pajak data exists in extend_db_ptrj history tables
 * for diagnosing why report-pajak doesn't show data
 *
 * Usage:
 *   cd backend
 *   bun run _dev_utils/scripts/debugging/check_tax_history_data.ts [month] [year]
 *
 * Examples:
 *   bun run _dev_utils/scripts/debugging/check_tax_history_data.ts 3 2026
 */

import { Database } from "../../../src/db/client";

async function main() {
    const args = process.argv.slice(2);
    const month = parseInt(args[0] || '3');
    const year = parseInt(args[1] || '2026');

    console.log('========================================================');
    console.log(`DEBUG: Check Tax/Pajak Data in History Tables`);
    console.log(`Period: ${month}/${year}`);
    console.log('========================================================\n');

    // Use SERVER_PROFILE_1 -> extend_db_ptrj (same as historyDatabaseService)
    const db = Database.getInstance('extend_db_ptrj', 'SERVER_PROFILE_1');

    try {
        // Check what columns exist in payroll_history_detail
        console.log('1. Checking payroll_history_detail columns...');
        const columns = await db.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'payroll_history_detail'
            ORDER BY ORDINAL_POSITION
        `);
        const colNames = columns.map((c: any) => c.COLUMN_NAME);
        console.log(`   Total columns: ${colNames.length}`);

        const taxCols = colNames.filter((k: string) =>
            k.toLowerCase().includes('pph') ||
            k.toLowerCase().includes('pajak') ||
            k.toLowerCase().includes('ptkp') ||
            k.toLowerCase().includes('ter') ||
            k.toLowerCase().includes('tarif') ||
            k.toLowerCase().includes('bruto')
        );
        console.log('   Tax-related columns:', taxCols.join(', '));
        console.log('');

        // Check payroll_history_header for our period
        console.log(`2. Checking payroll_history_header for M:${month} Y:${year}...`);
        const headers = await db.query(`
            SELECT id, period_month, period_year, gang_code, division_code
            FROM dbo.payroll_history_header
            WHERE period_month = ? AND period_year = ?
        `, [month, year]);

        console.log(`   Found ${headers.length} header records`);
        if (headers.length > 0) {
            for (const h of headers.slice(0, 3)) {
                console.log(`   - id=${h.id}, gang=${h.gang_code}, div=${h.division_code}`);
            }
        }
        console.log('');

        if (headers.length === 0) {
            console.log('========================================================');
            console.log('!!! NO HISTORY HEADER FOUND FOR THIS PERIOD !!!');
            console.log('========================================================');
            console.log('The aggregation seeder was never run or failed.');
            console.log('SOLUTION: Go to /admin/aggregation and run SEED AGGREGATION');
            console.log('========================================================');
            return;
        }

        const masterIds = headers.map((h: any) => h.id);
        const idList = masterIds.join(',');

        // Check first few detail records with tax fields
        console.log(`3. Checking detail records (sample)...`);
        const details = await db.query(`
            SELECT TOP 5
                emp_code, nik, emp_name, gang_code, division_code,
                status_ptkp,
                tarif_pajak_ter,
                pph21_ter,
                pot_pph21,
                penghasilan_bruto,
                jumlah_upah_kotor
            FROM dbo.payroll_history_detail
            WHERE master_id IN (${idList})
            ORDER BY emp_code
        `);

        console.log(`   Found ${details.length} sample detail records`);
        if (details.length > 0) {
            const first = details[0];
            console.log('\n   First record:');
            console.log(`   - emp_code: ${first.emp_code}`);
            console.log(`   - nik: ${first.nik}`);
            console.log(`   - emp_name: ${first.emp_name}`);
            console.log(`   - gang_code: ${first.gang_code}`);
            console.log(`   - division_code: ${first.division_code}`);
            console.log('');
            console.log('   Tax field values:');
            console.log(`   - status_ptkp: "${first.status_ptkp}" (${typeof first.status_ptkp})`);
            console.log(`   - tarif_pajak_ter: ${first.tarif_pajak_ter} (${typeof first.tarif_pajak_ter})`);
            console.log(`   - pph21_ter: ${first.pph21_ter} (${typeof first.pph21_ter})`);
            console.log(`   - pot_pph21: ${first.pot_pph21} (${typeof first.pot_pph21})`);
            console.log(`   - penghasilan_bruto: ${first.penghasilan_bruto} (${typeof first.penghasilan_bruto})`);
            console.log(`   - jumlah_upah_kotor: ${first.jumlah_upah_kotor} (${typeof first.jumlah_upah_kotor})`);
        }
        console.log('');

        // Aggregate check - how many have pph21_ter > 0
        console.log('4. Aggregating pph21_ter across all detail records...');
        const aggResult = await db.query(`
            SELECT
                COUNT(*) as total_rows,
                SUM(CASE WHEN pph21_ter IS NULL THEN 1 ELSE 0 END) as null_pph21,
                SUM(CASE WHEN pph21_ter = 0 THEN 1 ELSE 0 END) as zero_pph21,
                SUM(CASE WHEN pph21_ter > 0 THEN 1 ELSE 0 END) as has_pph21,
                SUM(pph21_ter) as total_pph21,
                SUM(CASE WHEN pot_pph21 IS NULL THEN 1 ELSE 0 END) as null_pot_pph21,
                SUM(CASE WHEN pot_pph21 = 0 THEN 1 ELSE 0 END) as zero_pot_pph21,
                SUM(CASE WHEN pot_pph21 > 0 THEN 1 ELSE 0 END) as has_pot_pph21,
                SUM(pot_pph21) as total_pot_pph21
            FROM dbo.payroll_history_detail
            WHERE master_id IN (${idList})
        `);

        const agg = aggResult[0];
        console.log('   Total detail rows:', agg.total_rows);
        console.log('   pph21_ter:');
        console.log(`      - NULL: ${agg.null_pph21}`);
        console.log(`      - = 0: ${agg.zero_pph21}`);
        console.log(`      - > 0: ${agg.has_pph21}`);
        console.log(`      - SUM: ${agg.total_pph21}`);
        console.log('   pot_pph21:');
        console.log(`      - NULL: ${agg.null_pot_pph21}`);
        console.log(`      - = 0: ${agg.zero_pot_pph21}`);
        console.log(`      - > 0: ${agg.has_pot_pph21}`);
        console.log(`      - SUM: ${agg.total_pot_pph21}`);
        console.log('');

        // Check if all pph21 fields are 0 or null
        if ((agg.has_pph21 || 0) === 0) {
            console.log('========================================================');
            console.log('!!! ALL ROWS HAVE pph21_ter = 0 or NULL !!!');
            console.log('========================================================');
            console.log('This is why pajak is not showing in report-pajak.');
            console.log('');
            console.log('POSSIBLE CAUSES:');
            console.log('1. The seeder did NOT calculate/save pph21_ter');
            console.log('2. The data was seeded BEFORE pph21 fix was implemented');
            console.log('3. The payroll for this period did NOT have PPh21 deductions');
            console.log('');
            console.log('SOLUTION: Re-seed the aggregation OR the seeder needs fixing');
            console.log('========================================================');
        } else {
            console.log('========================================================');
            console.log('Data appears OK - pph21_ter has values');
            console.log('========================================================');
            console.log('The issue might be in how TaxReportPage displays the data.');
            console.log('Check if the correct division/gang is selected.');
        }

    } catch (error: any) {
        console.error('Error:', error.message);
    }

    console.log('\n========================================================');
    console.log('END DEBUG');
    console.log('========================================================');
}

main().catch(console.error);
