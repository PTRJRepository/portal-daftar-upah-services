/**
 * Debug Virtual Divisions in Aggregation History
 * 
 * Run: cd backend && bun run debug_virtual_in_history.ts
 */

import { Database } from "./src/db/client";

async function checkVirtualDivisions() {
    console.log('=== CHECK VIRTUAL DIVISIONS IN AGGREGATION ===\n');

    const extendDb = Database.getExtendedInstance();
    const month = 3;
    const year = 2026;

    // Test 1: Check ALL data in aggregation history
    console.log('--- Test 1: All Data in Aggregation History ---');
    const query1 = `
        SELECT DISTINCT division_code, COUNT(*) as gang_count
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        GROUP BY division_code
        ORDER BY division_code
    `;
    
    try {
        const result = await extendDb.query<any>(query1, [month, year]);
        console.log(`Found ${result.length} divisions:\n`);
        result.forEach((r: any) => {
            console.log(`  ${r.division_code}: ${r.gang_count} gangs`);
        });
    } catch (error: any) {
        console.log(`✗ ERROR: ${error.message}`);
    }

    // Test 2: Check specific virtual divisions
    console.log('\n--- Test 2: Virtual Divisions Check ---');
    const virtualDivs = ['INF', 'NRS', 'WKS_PG', 'WKS_AR', 'ARC', 'MILL', 'WORKSHOP'];
    
    for (const div of virtualDivs) {
        const query = `
            SELECT COUNT(*) as count, 
                   SUM(total_employees) as employees,
                   SUM(total_upah_bersih) as upah
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ?
            AND division_code = ?
        `;
        
        try {
            const result = await extendDb.query<any>(query, [month, year, div]);
            const row = result[0];
            console.log(`  ${div}: ${row.count} gangs, ${row.employees} employees, upah=${row.upah || 0}`);
        } catch (error: any) {
            console.log(`  ${div}: ERROR - ${error.message}`);
        }
    }

    // Test 3: Check what gangs belong to each virtual division
    console.log('\n--- Test 3: Gang Details for Virtual Divisions ---');
    for (const div of virtualDivs) {
        const query = `
            SELECT gang_code, total_employees, total_upah_bersih
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = ? AND period_year = ?
            AND division_code = ?
            ORDER BY gang_code
        `;
        
        try {
            const result = await extendDb.query<any>(query, [month, year, div]);
            if (result.length > 0) {
                console.log(`\n  ${div} (${result.length} gangs):`);
                result.forEach((r: any) => {
                    console.log(`    ${r.gang_code}: emp=${r.total_employees}, upah=${r.total_upah_bersih}`);
                });
            } else {
                console.log(`  ${div}: NO DATA`);
            }
        } catch (error: any) {
            console.log(`  ${div}: ERROR - ${error.message}`);
        }
    }

    // Test 4: Check ALL gangs to see division distribution
    console.log('\n--- Test 4: All Gangs and Their Divisions (Sample) ---');
    const query4 = `
        SELECT TOP 30 division_code, gang_code, total_employees, total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        ORDER BY division_code, gang_code
    `;
    
    try {
        const result = await extendDb.query<any>(query4, [month, year]);
        console.log(`First 30 rows:\n`);
        result.forEach((r: any) => {
            console.log(`  ${r.division_code.padEnd(8)} | ${r.gang_code.padEnd(6)} | emp=${r.total_employees.toString().padStart(4)} | upah=${r.total_upah_bersih}`);
        });
    } catch (error: any) {
        console.log(`✗ ERROR: ${error.message}`);
    }

    console.log('\n=== CHECK COMPLETE ===');
}

checkVirtualDivisions().catch(error => {
    console.error('\n❌ Fatal error:', error);
    console.error('Message:', error.message);
    process.exit(1);
});
