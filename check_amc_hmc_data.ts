/**
 * Check exactly what data exists for AMC and HMC in aggregation table
 */

import { Database } from "./backend/src/db/client";

async function checkAmcHmc() {
    console.log("=== CHECKING AMC AND HMC IN AGGREGATION TABLE ===\n");
    
    const month = 3;
    const year = 2026;
    const extendDb = Database.getExtendedInstance();
    
    const query = `
        SELECT 
            division_code,
            gang_code,
            total_employees,
            total_hk,
            total_upah_bersih,
            total_premi,
            total_lembur
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        AND gang_code IN ('AMC', 'HMC', 'INF', 'INT', 'B2N')
        ORDER BY gang_code, division_code
    `;
    
    const rows = await extendDb.query<any>(query, [month, year]);
    
    console.log(`Found ${rows.length} rows:\n`);
    console.log("Gang".padEnd(8), "Division".padEnd(12), "Emp".padStart(6), "HK".padStart(8), "Upah Bersih".padStart(20));
    console.log("=".repeat(70));
    
    for (const row of rows) {
        console.log(
            (row.gang_code || 'NULL').padEnd(8),
            (row.division_code || 'NULL').padEnd(12),
            (row.total_employees || 0).toString().padStart(6),
            (row.total_hk || 0).toString().padStart(8),
            (row.total_upah_bersih || 0).toLocaleString('id-ID').padStart(20)
        );
    }
    
    console.log("\n=== ALL ROWS FOR WKS_PG, WKS_AR, WORKSHOP ===");
    const query2 = `
        SELECT 
            division_code,
            gang_code,
            total_employees,
            total_hk,
            total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        AND division_code IN ('WKS_PG', 'WKS_AR', 'WORKSHOP', 'PG1A', 'AB2')
        ORDER BY division_code, gang_code
    `;
    
    const rows2 = await extendDb.query<any>(query2, [month, year]);
    
    console.log(`\nFound ${rows2.length} rows:\n`);
    console.log("Division".padEnd(12), "Gang".padEnd(8), "Emp".padStart(6), "HK".padStart(8), "Upah Bersih".padStart(20));
    console.log("=".repeat(70));
    
    for (const row of rows2) {
        console.log(
            (row.division_code || 'NULL').padEnd(12),
            (row.gang_code || 'NULL').padEnd(8),
            (row.total_employees || 0).toString().padStart(6),
            (row.total_hk || 0).toString().padStart(8),
            (row.total_upah_bersih || 0).toLocaleString('id-ID').padStart(20)
        );
    }
    
    process.exit(0);
}

checkAmcHmc().catch(err => {
    console.error(err);
    process.exit(1);
});
