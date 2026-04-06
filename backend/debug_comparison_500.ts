/**
 * Debug Summary Comparison 500 Error
 * 
 * Purpose: Check why /payroll/summary/comparison returns 500 for months 3 & 4, 2026
 * 
 * Run: cd backend && bun run debug_comparison_500.ts
 */

import { Database } from "./src/db/client";

async function debugComparisonError() {
    console.log('=== DEBUG COMPARISON 500 ERROR ===\n');

    const extendDb = Database.getExtendedInstance();
    const months = [
        { month: 3, year: 2026, label: 'March 2026' },
        { month: 4, year: 2026, label: 'April 2026' }
    ];

    for (const { month, year, label } of months) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing Period: ${label} (${month}/${year})`);
        console.log('='.repeat(60));

        // Test 1: Check if data exists in daftar_upah_aggregation_history
        console.log(`\n--- Test 1: Aggregation History Data ---`);
        const query1 = `
            SELECT COUNT(*) as count,
                   COUNT(DISTINCT division_code) as divisions,
                   COUNT(DISTINCT gang_code) as gangs
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ?
        `;
        
        try {
            const result = await extendDb.query<any>(query1, [month, year]);
            console.log(`✓ Found: ${result[0]?.count || 0} rows, ${result[0]?.divisions || 0} divisions, ${result[0]?.gangs || 0} gangs`);
            
            if (result[0]?.count === 0) {
                console.log(`  ⚠️  NO DATA for ${label} - This will cause empty results!`);
                continue;
            }
            
            // Get sample divisions
            const sampleQuery = `
                SELECT DISTINCT division_code 
                FROM dbo.daftar_upah_aggregation_history
                WHERE period_month = ? AND period_year = ?
                ORDER BY division_code
            `;
            const divs = await extendDb.query<any>(sampleQuery, [month, year]);
            console.log(`  Divisions: ${divs.map((d: any) => d.division_code).join(', ')}`);
            
        } catch (error: any) {
            console.log(`✗ ERROR: ${error.message}`);
            console.log(`  Full error:`, error);
        }

        // Test 2: Check specific divisions (AB1, AB2, IJL)
        console.log(`\n--- Test 2: Check AB1, AB2, IJL data ---`);
        const targetDivs = ['AB1', 'AB2', 'IJL', 'P1A', 'P1B', 'P2A', 'P2B'];
        
        for (const div of targetDivs) {
            const query2 = `
                SELECT COUNT(*) as count
                FROM dbo.daftar_upah_aggregation_history
                WHERE period_month = ? AND period_year = ?
                AND division_code = ?
            `;
            
            try {
                const result = await extendDb.query<any>(query2, [month, year, div]);
                console.log(`  ${div}: ${result[0]?.count || 0} rows`);
            } catch (error: any) {
                console.log(`  ${div}: ERROR - ${error.message}`);
            }
        }

        // Test 3: Try the actual query from getAllDivisionsPremiTotals
        console.log(`\n--- Test 3: Main Aggregation Query ---`);
        const query3 = `
            SELECT
                h.gang_code,
                h.division_code,
                ISNULL(h.total_premi, 0) as total_premi,
                ISNULL(h.total_employees, 0) as total_employees,
                ISNULL(h.total_hk, 0) as total_hk,
                ISNULL(h.total_upah_bersih, 0) as total_upah_bersih,
                ISNULL(h.total_pph21, 0) as total_pph21,
                ISNULL(h.total_spsi, 0) as total_spsi,
                ISNULL(h.total_lembur, 0) as total_lembur,
                ISNULL(h.total_premi_brondol, 0) as total_premi_brondol,
                ISNULL(h.total_premi_prunning, 0) as total_premi_prunning,
                ISNULL(h.total_premi_insentif, 0) as total_premi_insentif,
                ISNULL(h.total_premi_kinerja, 0) as total_premi_kinerja,
                ISNULL(h.total_koreksi, 0) as total_koreksi,
                ISNULL(h.total_ffb_weight, 0) as total_ffb_weight,
                ISNULL(h.total_weight_tbs, 0) as total_weight_tbs
            FROM dbo.daftar_upah_aggregation_history h
            WHERE h.period_month = ? AND h.period_year = ?
              AND h.gang_code NOT IN ('IN', 'INT', 'AMC', 'HMC', 'B2N')
            ORDER BY h.division_code, h.gang_code
        `;
        
        try {
            const rows = await extendDb.query<any>(query3, [month, year]);
            console.log(`✓ Query successful: ${rows.length} rows returned`);
            
            if (rows.length > 0) {
                console.log(`  Sample rows:`);
                rows.slice(0, 3).forEach((row: any, idx: number) => {
                    console.log(`    ${idx + 1}. ${row.gang_code} (${row.division_code}) - premi=${row.total_premi}, employees=${row.total_employees}`);
                });
            }
        } catch (error: any) {
            console.log(`✗ ERROR: ${error.message}`);
            console.log(`  Full error:`, error);
        }
    }

    console.log('\n=== DEBUG COMPLETE ===');
    console.log('\nNext Steps:');
    console.log('1. If data is missing, run aggregation seeder');
    console.log('2. If query fails, check table schema');
    console.log('3. Check backend console logs for actual error');
}

debugComparisonError().catch(error => {
    console.error('\n❌ Fatal error:', error);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
});
