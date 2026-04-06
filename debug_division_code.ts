/**
 * Debug script to check what division_code values exist for P1A gangs
 */

import { Database } from "./backend/src/db/client";
import { divisionDefinition } from "./backend/src/services/divisionDefinition";

async function debugDivisionCode() {
    const month = 3;
    const year = 2026;
    
    console.log("=== CHECK DIVISION_CODE IN AGGREGATION TABLE ===\n");
    
    const extendDb = Database.getExtendedInstance();
    
    // Get P1A gangs
    const p1aGangs = await divisionDefinition.getGangsForDivision('P1A');
    const p1aGangCodes = p1aGangs.map(g => g.gang_code);
    console.log("P1A Gangs:", p1aGangCodes.join(', '));
    
    // Query WITHOUT filtering to see all division_code values
    const placeholders = p1aGangCodes.map(() => '?').join(',');
    
    const query = `
        SELECT TOP 20
            division_code, 
            gang_code,
            total_employees,
            total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        AND gang_code IN (${placeholders})
        ORDER BY gang_code, division_code
    `;
    
    const rows = await extendDb.query<any>(query, [month, year, ...p1aGangCodes]);
    
    console.log(`\nFound ${rows.length} rows:`);
    console.log("Row | Gang     | division_code | Employees | Upah Bersih");
    console.log("----|----------|---------------|-----------|------------");
    
    rows.forEach((row, idx) => {
        console.log(`${(idx+1).toString().padStart(4)} | ${(row.gang_code || '').padEnd(8)} | ${(row.division_code || 'NULL').padEnd(13)} | ${(row.total_employees || 0).toString().padStart(9)} | ${(row.total_upah_bersih || 0).toLocaleString('id-ID')}`);
    });
    
    // Check if there are duplicate gang+division combinations
    console.log("\n\n--- Checking for duplicates ---");
    const dupQuery = `
        SELECT 
            gang_code,
            division_code,
            COUNT(*) as cnt,
            SUM(total_employees) as total_emp,
            SUM(total_upah_bersih) as total_upah
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        AND gang_code IN (${placeholders})
        GROUP BY gang_code, division_code
        HAVING COUNT(*) > 1
    `;
    
    const dups = await extendDb.query<any>(dupQuery, [month, year, ...p1aGangCodes]);
    
    if (dups.length === 0) {
        console.log("No duplicates found - each gang+division combination appears only once");
    } else {
        console.log("Duplicates found:");
        dups.forEach(row => {
            console.log(`  ${row.gang_code} / ${row.division_code}: ${row.cnt} rows, emp=${row.total_emp}, upah=${row.total_upah.toLocaleString('id-ID')}`);
        });
    }
    
    console.log("\n=== END ===");
    process.exit(0);
}

debugDivisionCode().catch(err => {
    console.error(err);
    process.exit(1);
});
