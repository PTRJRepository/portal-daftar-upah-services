/**
 * Remove duplicate WORKSHOP rows from aggregation table
 * Keep only WKS_PG and WKS_AR, WORKSHOP will be computed
 */

import { Database } from "./backend/src/db/client";

async function removeWorkshopDuplicates() {
    console.log("=== REMOVING DUPLICATE WORKSHOP ROWS ===\n");
    
    const month = 3;
    const year = 2026;
    const extendDb = Database.getExtendedInstance();
    
    // Check what we're about to delete
    console.log("Rows that will be deleted (WORKSHOP division):");
    const checkQuery = `
        SELECT gang_code, division_code, total_employees, total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        AND division_code = 'WORKSHOP'
    `;
    
    const checkRows = await extendDb.query<any>(checkQuery, [month, year]);
    console.log(`Found ${checkRows.length} rows:\n`);
    
    for (const row of checkRows) {
        console.log(`  ${row.gang_code.padEnd(8)} → ${row.division_code.padEnd(12)} emp=${row.total_employees} upah=${(row.total_upah_bersih || 0).toLocaleString('id-ID')}`);
    }
    
    // Delete WORKSHOP rows
    console.log("\nDeleting WORKSHOP rows...");
    const deleteQuery = `
        DELETE FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        AND division_code = 'WORKSHOP'
    `;
    
    const result = await extendDb.query<any>(deleteQuery, [month, year]);
    console.log(`✅ Deleted ${result.affected || checkRows.length} rows\n`);
    
    // Verify
    console.log("Verifying - remaining virtual division rows:");
    const verifyQuery = `
        SELECT gang_code, division_code, total_employees, total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        AND division_code IN ('WKS_PG', 'WKS_AR', 'INF', 'NRS')
        ORDER BY division_code, gang_code
    `;
    
    const verifyRows = await extendDb.query<any>(verifyQuery, [month, year]);
    for (const row of verifyRows) {
        console.log(`  ${row.gang_code.padEnd(8)} → ${row.division_code.padEnd(12)} emp=${row.total_employees} upah=${(row.total_upah_bersih || 0).toLocaleString('id-ID')}`);
    }
    
    console.log("\n=== DONE ===");
    console.log("WORKSHOP will now be computed from WKS_PG + WKS_AR without duplicates");
    process.exit(0);
}

removeWorkshopDuplicates().catch(err => {
    console.error(err);
    process.exit(1);
});
