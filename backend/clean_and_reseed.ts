/**
 * Script to clean and re-seed history data
 * Run this AFTER applying the virtual division fix
 */

import { Database } from './src/db/client';

async function cleanAndReseed() {
    console.log('🧹 Cleaning and Re-seeding History Data...\n');

    const db = Database.getExtendedInstance();

    try {
        // Step 1: Check current data
        console.log('📊 Checking current history data...');
        const currentData = await db.query(`
            SELECT division_code, gang_code, COUNT(*) as cnt
            FROM dbo.daftar_upah_aggregation_history
            GROUP BY division_code, gang_code
            ORDER BY division_code, gang_code
        `);

        console.log('\nCurrent data in history:');
        currentData.forEach((row: any) => {
            console.log(`  ${row.division_code} -> ${row.gang_code}: ${row.cnt} records`);
        });

        // Step 2: Check for virtual gangs in parent divisions
        console.log('\n⚠️  Checking for virtual gangs in parent divisions...');
        const badData = await db.query(`
            SELECT division_code, gang_code, period_month, period_year
            FROM dbo.daftar_upah_aggregation_history
            WHERE (division_code = 'PG1A' AND gang_code = 'AMC')
               OR (division_code = 'AB2' AND gang_code = 'HMC')
               OR (division_code = 'PG1A' AND gang_code LIKE '%HMC%')
               OR (division_code = 'AB2' AND gang_code LIKE '%AMC%')
            ORDER BY division_code, gang_code, period_year, period_month
        `);

        if (badData.length > 0) {
            console.log(`\n❌ Found ${badData.length} records with virtual gangs in wrong division:`);
            badData.forEach((row: any) => {
                console.log(`  ${row.division_code} -> ${row.gang_code} (Period: ${row.period_month}/${row.period_year})`);
            });

            // Step 3: Ask for confirmation
            console.log('\n⚠️  These records need to be DELETED and re-seeded correctly.');
            console.log('   Run the seeder from UI after this cleanup.\n');

            // Uncomment to delete bad data:
            // const deleteResult = await db.query(`
            //     DELETE FROM dbo.daftar_upah_aggregation_history
            //     WHERE (division_code = 'PG1A' AND gang_code = 'AMC')
            //        OR (division_code = 'AB2' AND gang_code = 'HMC')
            // `);
            // console.log(`✅ Deleted ${deleteResult.affectedRows} bad records`);

        } else {
            console.log('✅ No virtual gangs found in wrong divisions!');
        }

        // Step 4: Summary
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 NEXT STEPS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('1. Restart backend to apply fixes');
        console.log('2. Open UI -> Aggregation Seeder');
        console.log('3. Select division: P1A, Month: 3, Year: 2026');
        console.log('4. Click "Seed"');
        console.log('5. Repeat for AB2');
        console.log('6. Check Summary Report - virtual gangs should be separate!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('❌ Error:', error);
    }

    process.exit(0);
}

cleanAndReseed();
