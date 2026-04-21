/**
 * Check for ALL duplicates in aggregation table
 */

import { Database } from "./backend/src/db/client";

async function checkAllDuplicates() {
    console.log("=== CHECKING ALL DUPLICATES IN AGGREGATION TABLE ===\n");
    
    const month = 3;
    const year = 2026;
    const extendDb = Database.getExtendedInstance();
    
    // Find all duplicate gang+division combinations
    const query = `
        SELECT 
            gang_code,
            division_code,
            COUNT(*) as cnt,
            SUM(total_employees) as total_emp,
            SUM(total_upah_bersih) as total_upah
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        GROUP BY gang_code, division_code
        HAVING COUNT(*) > 1
        ORDER BY gang_code, division_code
    `;
    
    const dups = await extendDb.query<any>(query, [month, year]);
    
    if (dups.length === 0) {
        console.log("✅ No duplicates found - each gang+division combination appears only once\n");
    } else {
        console.log(`Found ${dups.length} duplicate gang+division combinations:\n`);
        console.log("Gang".padEnd(10), "Division".padEnd(12), "Count".padStart(8), "Total Emp".padStart(12), "Total Upah".padStart(20));
        console.log("=".repeat(70));
        
        for (const row of dups) {
            console.log(
                (row.gang_code || 'NULL').padEnd(10),
                (row.division_code || 'NULL').padEnd(12),
                row.cnt.toString().padStart(8),
                (row.total_emp || 0).toString().padStart(12),
                (row.total_upah || 0).toLocaleString('id-ID').padStart(20)
            );
        }
    }
    
    // Show all rows for INF, INT, B2N to see if there are issues
    console.log("\n\n=== ALL ROWS FOR INF, INT, B2N ===");
    const specificQuery = `
        SELECT 
            gang_code,
            division_code,
            total_employees,
            total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        AND gang_code IN ('INF', 'INT', 'B2N')
        ORDER BY gang_code, division_code
    `;
    
    const rows = await extendDb.query<any>(specificQuery, [month, year]);
    
    console.log("\nGang".padEnd(10), "Division".padEnd(12), "Employees".padStart(10), "Upah Bersih".padStart(20));
    console.log("=".repeat(60));
    
    for (const row of rows) {
        console.log(
            (row.gang_code || 'NULL').padEnd(10),
            (row.division_code || 'NULL').padEnd(12),
            (row.total_employees || 0).toString().padStart(10),
            (row.total_upah_bersih || 0).toLocaleString('id-ID').padStart(20)
        );
    }
    
    console.log("\n=== END ===");
    process.exit(0);
}

checkAllDuplicates().catch(err => {
    console.error(err);
    process.exit(1);
});
