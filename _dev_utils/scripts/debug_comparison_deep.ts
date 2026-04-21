/**
 * Debug Comparison - Test All Parallel Queries
 * 
 * Run: cd backend && bun run debug_comparison_deep.ts
 */

import { Database } from "./src/db/client";
import { join } from "path";
import { file } from "bun";

async function testAllQueries() {
    console.log('=== DEEP COMPARISON DEBUG ===\n');

    const extendDb = Database.getExtendedInstance();
    const month = 3;
    const year = 2026;

    // Test 1: getDivisionDescriptions
    console.log('--- Test 1: Division Descriptions ---');
    try {
        const rows = await extendDb.query<any>(
            "SELECT [Divisi], [Divisi_Desc] FROM [dbo].[Divisi_Description] WHERE [Divisi] IS NOT NULL"
        );
        console.log(`✓ Found ${rows.length} divisions`);
    } catch (error: any) {
        console.log(`✗ ERROR: ${error.message}`);
    }

    // Test 2: getGangToDivisionMap
    console.log('\n--- Test 2: Gang to Division Map ---');
    try {
        const rows = await extendDb.query<any>(
            "SELECT gang_code, ISNULL(loc_code, '') as loc_code FROM dbo.HR_GANG"
        );
        console.log(`✓ Found ${rows.length} gangs`);
    } catch (error: any) {
        console.log(`✗ ERROR: ${error.message}`);
    }

    // Test 3: getAllGangDescriptions
    console.log('\n--- Test 3: Gang Descriptions ---');
    try {
        const rows = await extendDb.query<any>(
            "SELECT gang_code, ISNULL(description, '') as description FROM dbo.HR_GANG"
        );
        console.log(`✓ Found ${rows.length} gangs`);
    } catch (error: any) {
        console.log(`✗ ERROR: ${error.message}`);
    }

    // Test 4: loadThumbprintData
    console.log('\n--- Test 4: Thumbprint Data ---');
    try {
        const thumbprintFile = file(join(process.cwd(), "data", `thumbprint_${year}_${month}.json`));
        const exists = await thumbprintFile.exists();
        if (exists) {
            const data = await thumbprintFile.json();
            console.log(`✓ Loaded from thumbprint_${year}_${month}.json: ${Object.keys(data).length} entries`);
        } else {
            console.log(`⚠️  File thumbprint_${year}_${month}.json not found, returning empty`);
        }
    } catch (error: any) {
        console.log(`✗ ERROR: ${error.message}`);
    }

    // Test 5: getBackfillData
    console.log('\n--- Test 5: Backfill Data ---');
    try {
        const query = `
            SELECT division_code, gang_code, total_upah_bersih, total_employees
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ?
        `;
        const rows = await extendDb.query<any>(query, [month, year]);
        console.log(`✓ Found ${rows.length} backfill rows`);
    } catch (error: any) {
        console.log(`✗ ERROR: ${error.message}`);
    }

    // Test 6: fetchTonaseFromMill
    console.log('\n--- Test 6: Tonase from Mill ---');
    try {
        const query = `
            SELECT 
                LOKASI as division_code,
                CAST(TONS as DECIMAL(18,2)) as tonase
            FROM WM_TONASEESTATE
            WHERE BULAN = ? AND TAHUN = ?
        `;
        const rows = await extendDb.query<any>(query, [month, year]);
        console.log(`✓ Found ${rows.length} tonase rows`);
    } catch (error: any) {
        console.log(`✗ ERROR: ${error.message}`);
        console.log(`  Note: WM_TONASEESTATE might not exist or have different schema`);
    }

    // Test 7: The main aggregation query
    console.log('\n--- Test 7: Main Aggregation Query ---');
    try {
        const query = `
            SELECT
                h.gang_code,
                h.division_code,
                ISNULL(h.total_premi, 0) as total_premi,
                ISNULL(h.total_employees, 0) as total_employees,
                ISNULL(h.total_hk, 0) as total_hk,
                ISNULL(h.total_upah_bersih, 0) as total_upah_bersih
            FROM dbo.daftar_upah_aggregation_history h
            WHERE h.period_month = ? AND h.period_year = ?
              AND h.gang_code NOT IN ('IN', 'INT', 'AMC', 'HMC', 'B2N')
        `;
        const rows = await extendDb.query<any>(query, [month, year]);
        console.log(`✓ Found ${rows.length} rows`);
        
        // Try to do the aggregation
        const divAgg: Record<string, any> = {};
        for (const row of rows) {
            const div = row.division_code;
            if (!divAgg[div]) {
                divAgg[div] = { premi: 0, employees: 0, hk: 0, upah: 0 };
            }
            divAgg[div].premi += parseFloat(row.total_premi || 0);
            divAgg[div].employees += parseInt(row.total_employees || 0);
            divAgg[div].hk += parseFloat(row.total_hk || 0);
            divAgg[div].upah += parseFloat(row.total_upah_bersih || 0);
        }
        
        console.log(`\nAggregated by division:`);
        for (const [div, data] of Object.entries(divAgg)) {
            console.log(`  ${div}: premi=${data.premi.toLocaleString()}, employees=${data.employees}, upah=${data.upah.toLocaleString()}`);
        }
    } catch (error: any) {
        console.log(`✗ ERROR: ${error.message}`);
        console.log(`  Stack:`, error.stack);
    }

    console.log('\n=== TEST COMPLETE ===');
}

testAllQueries().catch(error => {
    console.error('\n❌ Fatal error:', error);
    console.error('Message:', error.message);
    process.exit(1);
});
