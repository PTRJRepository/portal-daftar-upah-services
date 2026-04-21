/**
 * Fix script to update division_code in aggregation history for virtual division gangs
 */

import { Database } from "./backend/src/db/client";

async function fixAggregationDivisionCodes() {
    const month = 3;
    const year = 2026;
    
    console.log("=== FIX AGGREGATION DIVISION CODES ===\n");
    
    const extendDb = Database.getExtendedInstance();
    
    // Update AMC from P1A to WKS_PG
    console.log("Updating AMC from P1A to WKS_PG...");
    const updateAmc = `
        UPDATE dbo.daftar_upah_aggregation_history
        SET division_code = 'WKS_PG'
        WHERE period_month = ? AND period_year = ?
        AND gang_code = 'AMC' AND division_code = 'P1A'
    `;
    const amcResult = await extendDb.query<any>(updateAmc, [month, year]);
    console.log(`  Updated ${amcResult.affected || 0} rows\n`);
    
    // Update INF from P1A to INF
    console.log("Updating INF from P1A to INF...");
    const updateInf = `
        UPDATE dbo.daftar_upah_aggregation_history
        SET division_code = 'INF'
        WHERE period_month = ? AND period_year = ?
        AND gang_code = 'INF' AND division_code = 'P1A'
    `;
    const infResult = await extendDb.query<any>(updateInf, [month, year]);
    console.log(`  Updated ${infResult.affected || 0} rows\n`);
    
    // Update INT from P1A to INF
    console.log("Updating INT from P1A to INF...");
    const updateInt = `
        UPDATE dbo.daftar_upah_aggregation_history
        SET division_code = 'INF'
        WHERE period_month = ? AND period_year = ?
        AND gang_code = 'INT' AND division_code = 'P1A'
    `;
    const intResult = await extendDb.query<any>(updateInt, [month, year]);
    console.log(`  Updated ${intResult.affected || 0} rows\n`);
    
    // Update B2N from P1B to NRS
    console.log("Updating B2N from P1B to NRS...");
    const updateB2n = `
        UPDATE dbo.daftar_upah_aggregation_history
        SET division_code = 'NRS'
        WHERE period_month = ? AND period_year = ?
        AND gang_code = 'B2N' AND division_code = 'P1B'
    `;
    const b2nResult = await extendDb.query<any>(updateB2n, [month, year]);
    console.log(`  Updated ${b2nResult.affected || 0} rows\n`);
    
    // Update HMC from AB2 to WKS_AR
    console.log("Updating HMC from AB2 to WKS_AR...");
    const updateHmc = `
        UPDATE dbo.daftar_upah_aggregation_history
        SET division_code = 'WKS_AR'
        WHERE period_month = ? AND period_year = ?
        AND gang_code = 'HMC' AND division_code = 'AB2'
    `;
    const hmcResult = await extendDb.query<any>(updateHmc, [month, year]);
    console.log(`  Updated ${hmcResult.affected || 0} rows\n`);
    
    // Verify the fixes
    console.log("\n=== VERIFY AFTER UPDATE ===");
    const verifyQuery = `
        SELECT 
            gang_code,
            division_code,
            total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        AND gang_code IN ('AMC', 'INF', 'INT', 'B2N', 'HMC')
        ORDER BY gang_code
    `;
    
    const verifyRows = await extendDb.query<any>(verifyQuery, [month, year]);
    console.log("\nVirtual division gangs after update:");
    for (const row of verifyRows) {
        console.log(`  ${row.gang_code.padEnd(8)} -> ${row.division_code.padEnd(10)} (${(row.total_upah_bersih || 0).toLocaleString('id-ID')})`);
    }
    
    // Check P1A total
    const p1aQuery = `
        SELECT 
            gang_code,
            division_code,
            total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        AND division_code = 'P1A'
        ORDER BY gang_code
    `;
    
    const p1aRows = await extendDb.query<any>(p1aQuery, [month, year]);
    const p1aTotal = p1aRows.reduce((sum, r) => sum + (r.total_upah_bersih || 0), 0);
    
    console.log(`\nP1A gangs after update: ${p1aRows.length}`);
    for (const row of p1aRows) {
        console.log(`  ${row.gang_code.padEnd(8)} (${(row.total_upah_bersih || 0).toLocaleString('id-ID')})`);
    }
    console.log(`P1A Total: ${p1aTotal.toLocaleString('id-ID')}`);
    
    console.log("\n=== END ===");
    process.exit(0);
}

fixAggregationDivisionCodes().catch(err => {
    console.error(err);
    process.exit(1);
});
