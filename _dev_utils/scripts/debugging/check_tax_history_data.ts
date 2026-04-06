/**
 * Debug Script: Check what tax/pajak data exists in extend_db_ptrj history tables
 * via the SQL Gateway API - for diagnosing why pajak doesn't show in report-pajak
 *
 * Usage:
 *   cd backend
 *   bun run _dev_utils/scripts/debugging/check_tax_history_data.ts [month] [year] [gang]
 *
 * Examples:
 *   bun run _dev_utils/scripts/debugging/check_tax_history_data.ts 3 2026
 *   bun run _dev_utils/scripts/debugging/check_tax_history_data.ts 3 2026 H1H
 */

import Config from '../../src/config';
import { Database } from '../../src/db/client';

async function main() {
    const args = process.argv.slice(2);
    const month = parseInt(args[0] || '3');
    const year = parseInt(args[1] || '2026');
    const gang = args[2] || 'ALL';

    console.log('========================================================');
    console.log(`DEBUG: Check Tax/Pajak Data in History Tables`);
    console.log(`Period: ${month}/${year}, Gang: ${gang}`);
    console.log(`Gateway: ${Config.DB_API_URL}`);
    console.log(`Profile: ${Config.DB_EXTEND_PROFILE}`);
    console.log(`Database: ${Config.DB_EXTEND_DATABASE}`);
    console.log('========================================================\n');

    // Use the same database instance as historyDatabaseService
    // This uses SERVER_PROFILE_1 -> extend_db_ptrj
    const db = Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);

    try {
        // Check tables in the database
        console.log('1. Checking available tables...');
        const tables = await db.query(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME LIKE '%payroll%' OR TABLE_NAME LIKE '%history%'
            ORDER BY TABLE_NAME
        `);
        console.log('   Tables found:', tables.map((t: any) => t.TABLE_NAME));
        console.log('');

        // Check payroll_history_header for our period
        console.log(`2. Checking payroll_history_header for M:${month} Y:${year}...`);
        let headersSql = `
            SELECT id, period_month, period_year, gang_code, division_code,
                   dynamic_premi_data, dynamic_potongan_data
            FROM dbo.payroll_history_header
            WHERE period_month = ? AND period_year = ?
        `;
        const headersParams: any[] = [month, year];

        if (gang !== 'ALL') {
            headersSql += ` AND gang_code = ?`;
            headersParams.push(gang);
        }

        const headers = await db.query(headersSql, headersParams);
        console.log(`   Found ${headers.length} header records`);
        if (headers.length > 0) {
            console.log('   Header keys:', Object.keys(headers[0]));
            for (const h of headers.slice(0, 3)) {
                console.log(`   - id=${h.id}, gang=${h.gang_code}, div=${h.division_code}`);
            }
        }
        console.log('');

        // Get the detail table columns
        console.log('3. Getting payroll_history_detail column info...');
        const columns = await db.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'payroll_history_detail'
            ORDER BY ORDINAL_POSITION
        `);
        const colNames = columns.map((c: any) => c.COLUMN_NAME);
        console.log('   All columns:', colNames.join(', '));
        console.log('');

        // Check for tax-related columns
        const taxCols = colNames.filter((k: string) =>
            k.toLowerCase().includes('pph') ||
            k.toLowerCase().includes('pajak') ||
            k.toLowerCase().includes('ptkp') ||
            k.toLowerCase().includes('ter') ||
            k.toLowerCase().includes('tarif') ||
            k.toLowerCase().includes('bruto')
        );
        console.log('   Tax-related columns:', taxCols.length > 0 ? taxCols : ['!!! NONE !!!']);
        console.log('');

        if (headers.length === 0) {
            console.log('========================================================');
            console.log('!!! NO HISTORY HEADER FOUND FOR THIS PERIOD !!!');
            console.log('========================================================');
            console.log('Possible causes:');
            console.log('1. Aggregation seeder was NEVER run for this period');
            console.log('2. Seeding failed or was cancelled');
            console.log('3. Data exists under different gang/division');
            console.log('');
            console.log('SOLUTION: Go to /admin/aggregation and run "SEED AGGREGATION"');
            console.log('========================================================');
            return;
        }

        // Get master IDs for detail query
        const masterIds = headers.map((h: any) => h.id);

        console.log(`4. Checking payroll_history_detail for ${masterIds.length} masters...`);

        // First check - what columns actually exist in detail?
        let detailSql = `
            SELECT TOP 3
                emp_code, nik, nama, gang_code,
                status_ptkp, tarif_pajak_ter, pph21_ter,
                pot_pph21, penghasilan_bruto, jumlah_upah_kotor
            FROM dbo.payroll_history_detail d
            INNER JOIN dbo.payroll_history_header h ON d.master_id = h.id
            WHERE h.period_month = ? AND h.period_year = ?
        `;
        const detailParams: any[] = [month, year];

        if (gang !== 'ALL') {
            detailSql += ` AND h.gang_code = ?`;
            detailParams.push(gang);
        }

        detailSql += ` ORDER BY d.emp_code`;

        const details = await db.query(detailSql, detailParams);
        console.log(`   Found ${details.length} sample detail records`);
        console.log('');

        if (details.length === 0) {
            console.log('!!! NO DETAIL DATA FOUND !!!');
            console.log('This means headers exist but details were not saved.');
            console.log('The seeder may have failed mid-process.');
            return;
        }

        // Show first detail record with all tax fields
        const first = details[0];
        console.log('   First record sample:');
        console.log(`   - emp_code: ${first.emp_code}`);
        console.log(`   - nik: ${first.nik}`);
        console.log(`   - nama: ${first.nama}`);
        console.log(`   - gang_code: ${first.gang_code}`);
        console.log('');
        console.log('   Tax field values (first record):');
        console.log(`   - status_ptkp: ${first.status_ptkp} (${typeof first.status_ptkp})`);
        console.log(`   - tarif_pajak_ter: ${first.tarif_pajak_ter} (${typeof first.tarif_pajak_ter})`);
        console.log(`   - pph21_ter: ${first.pph21_ter} (${typeof first.pph21_ter})`);
        console.log(`   - pot_pph21: ${first.pot_pph21} (${typeof first.pot_pph21})`);
        console.log(`   - penghasilan_bruto: ${first.penghasilan_bruto} (${typeof first.penghasilan_bruto})`);
        console.log(`   - jumlah_upah_kotor: ${first.jumlah_upah_kotor} (${typeof first.jumlah_upah_kotor})`);
        console.log('');

        // Check for null/undefined tax data
        const nullTaxFields = [];
        if (first.status_ptkp === null || first.status_ptkp === undefined) nullTaxFields.push('status_ptkp');
        if (first.tarif_pajak_ter === null || first.tarif_pajak_ter === undefined) nullTaxFields.push('tarif_pajak_ter');
        if (first.pph21_ter === null || first.pph21_ter === undefined) nullTaxFields.push('pph21_ter');
        if (first.pot_pph21 === null || first.pot_pph21 === undefined) nullTaxFields.push('pot_pph21');
        if (first.penghasilan_bruto === null || first.penghasilan_bruto === undefined) nullTaxFields.push('penghasilan_bruto');

        if (nullTaxFields.length > 0) {
            console.log(`   !!! NULL TAX FIELDS: ${nullTaxFields.join(', ')} !!!`);
            console.log('   This explains why pajak data is not displayed.');
        }

        // Check pph21_ter is 0
        if (first.pph21_ter === 0) {
            console.log('   !!! pph21_ter is 0 - no tax was calculated/stored !!!');
        }

        // Also check all rows to see how many have pph21_ter
        console.log('\n5. Checking all rows for pph21_ter...');
        let countSql = `
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN pph21_ter IS NULL OR pph21_ter = 0 THEN 1 ELSE 0 END) as zero_pph21,
                   SUM(CASE WHEN pph21_ter > 0 THEN 1 ELSE 0 END) as has_pph21
            FROM dbo.payroll_history_detail d
            INNER JOIN dbo.payroll_history_header h ON d.master_id = h.id
            WHERE h.period_month = ? AND h.period_year = ?
        `;
        const countParams: any[] = [month, year];
        if (gang !== 'ALL') {
            countSql += ` AND h.gang_code = ?`;
            countParams.push(gang);
        }

        const counts = await db.query(countSql, countParams);
        const c = counts[0];
        console.log(`   Total rows: ${c.total}`);
        console.log(`   Rows with pph21_ter = 0 or NULL: ${c.zero_pph21}`);
        console.log(`   Rows with pph21_ter > 0: ${c.has_pph21}`);

        if (c.has_pph21 === 0 && c.total > 0) {
            console.log('\n   !!! ALL rows have pph21_ter = 0 or NULL !!!');
            console.log('   This means TAX DATA was NOT calculated/stored during seeding.');
            console.log('');
            console.log('   POSSIBLE CAUSES:');
            console.log('   1. The seeder did NOT include pph21 calculation');
            console.log('   2. The payroll data for that period did NOT have pph21 deductions');
            console.log('   3. The seeder was run BEFORE the pph21 fix was implemented');
            console.log('');
            console.log('   To fix: Re-seed the aggregation for this period');
        }

    } catch (error: any) {
        console.error('Error:', error.message);
        if (error.stack) {
            console.error(error.stack.split('\n').slice(0, 5).join('\n'));
        }
    }

    console.log('\n========================================================');
    console.log('END DEBUG');
    console.log('========================================================');
}

main().catch(console.error);
