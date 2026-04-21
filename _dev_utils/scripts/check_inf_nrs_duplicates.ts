/**
 * Check for duplicate INF and NRS entries
 */

import { Database } from "./backend/src/db/client";

async function checkDuplicates() {
    console.log("=== CHECKING INF AND NRS DUPLICATES ===\n");
    
    const month = 3;
    const year = 2026;
    const extendDb = Database.getExtendedInstance();
    
    // Query to see all INF and NRS entries
    const query = `
        SELECT 
            division_code,
            gang_code,
            total_employees,
            total_upah_bersih,
            total_premi,
            total_lembur
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        AND (
            division_code IN ('INF', 'NRS', 'PG1A', 'PG1B', 'P1A', 'P1B')
            OR gang_code IN ('INF', 'INT', 'B2N', 'AMC', 'HMC')
        )
        ORDER BY division_code, gang_code
    `;
    
    const rows = await extendDb.query<any>(query, [month, year]);
    
    console.log(`Found ${rows.length} rows\n`);
    console.log("Division".padEnd(12), "Gang".padEnd(10), "Employees".padStart(10), "Upah Bersih".padStart(20));
    console.log("=".repeat(60));
    
    for (const row of rows) {
        console.log(
            (row.division_code || 'NULL').padEnd(12),
            (row.gang_code || 'NULL').padEnd(10),
            (row.total_employees || 0).toString().padStart(10),
            (row.total_upah_bersih || 0).toLocaleString('id-ID').padStart(20)
        );
    }
    
    // Check for duplicate gang entries
    console.log("\n\n=== CHECKING FOR DUPLICATE GANGS ===");
    const dupQuery = `
        SELECT 
            gang_code,
            division_code,
            COUNT(*) as cnt,
            SUM(total_employees) as total_emp,
            SUM(total_upah_bersih) as total_upah
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        AND gang_code IN ('INF', 'INT', 'B2N')
        GROUP BY gang_code, division_code
        ORDER BY gang_code, division_code
    `;
    
    const dups = await extendDb.query<any>(dupQuery, [month, year]);
    
    console.log("\nGang".padEnd(10), "Division".padEnd(12), "Count".padStart(8), "Total Emp".padStart(12), "Total Upah".padStart(20));
    console.log("=".repeat(70));
    
    for (const row of dups) {
        const isDup = row.cnt > 1 ? ' ⚠️ DUPLICATE' : '';
        console.log(
            (row.gang_code || 'NULL').padEnd(10),
            (row.division_code || 'NULL').padEnd(12),
            row.cnt.toString().padStart(8),
            (row.total_emp || 0).toString().padStart(12),
            (row.total_upah || 0).toLocaleString('id-ID').padStart(20),
            isDup
        );
    }
    
    console.log("\n=== END ===");
    process.exit(0);
}

checkDuplicates().catch(err => {
    console.error(err);
    process.exit(1);
});
