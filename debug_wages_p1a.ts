/**
 * Debug script to check P1A division totals in wages recap-all
 */

import { Database } from "./backend/src/db/client";
import { divisionDefinition } from "./backend/src/services/divisionDefinition";

async function debugP1A() {
    const month = 3; // March
    const year = 2026;
    
    console.log("=== DEBUG P1A DIVISION TOTALS ===\n");
    
    const extendDb = Database.getExtendedInstance();
    
    // Get P1A gangs
    const p1aGangs = await divisionDefinition.getGangsForDivision('P1A');
    console.log("P1A Gangs:", p1aGangs.map(g => g.gang_code).join(', '));
    
    // Query aggregation history for P1A gangs
    const placeholders = p1aGangs.map(() => '?').join(',');
    
    console.log("\n--- Query 1: Group by division_code (CURRENT BEHAVIOR) ---");
    const query1 = `
        SELECT 
            division_code, 
            gang_code,
            total_employees,
            total_upah_bersih,
            total_premi,
            total_lembur
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        AND gang_code IN (${placeholders})
        ORDER BY gang_code
    `;
    
    const rows1 = await extendDb.query<any>(query1, [month, year, ...p1aGangs.map(g => g.gang_code)]);
    
    console.log(`Found ${rows1.length} rows:`);
    let sumByDivCode: Record<string, number> = {};
    for (const row of rows1) {
        console.log(`  ${row.gang_code.padEnd(8)} | div_code=${(row.division_code || 'NULL').padEnd(8)} | emp=${(row.total_employees || 0).toString().padStart(5)} | upah=${(row.total_upah_bersih || 0).toLocaleString('id-ID').padStart(15)}`);
        if (!sumByDivCode[row.division_code]) sumByDivCode[row.division_code] = 0;
        sumByDivCode[row.division_code] += (row.total_upah_bersih || 0);
    }
    
    console.log("\nSum grouped by division_code (from DB):");
    for (const [div, total] of Object.entries(sumByDivCode)) {
        console.log(`  ${div}: ${total.toLocaleString('id-ID')}`);
    }
    
    console.log("\n--- Query 2: What SHOULD be (group by P1A assignment) ---");
    let sumForP1A = 0;
    let empForP1A = 0;
    let premiForP1A = 0;
    let lemburForP1A = 0;
    
    for (const row of rows1) {
        sumForP1A += (row.total_upah_bersih || 0);
        empForP1A += (row.total_employees || 0);
        premiForP1A += (row.total_premi || 0);
        lemburForP1A += (row.total_lembur || 0);
    }
    
    console.log(`P1A Total (all gangs): emp=${empForP1A}, upah_bersih=${sumForP1A.toLocaleString('id-ID')}, premi=${premiForP1A.toLocaleString('id-ID')}, lembur=${lemburForP1A.toLocaleString('id-ID')}`);
    
    console.log("\n--- Query 3: Check ALL divisions to see where gangs are assigned ---");
    const allDivisions = ['P1A', 'P1B', 'P2A', 'P2B', 'AB1', 'AB2', 'ARC', 'ARA', 'DME', 'IJL', 'INF', 'NRS', 'WKS_PG', 'WKS_AR', 'WORKSHOP'];
    const divisionGangs: Record<string, string[]> = {};
    for (const divCode of allDivisions) {
        const gangs = await divisionDefinition.getGangsForDivision(divCode);
        divisionGangs[divCode] = gangs.map(g => g.gang_code);
    }
    
    // Get all rows for all gangs
    const allGangs = Object.values(divisionGangs).flat();
    const allPlaceholders = allGangs.map(() => '?').join(',');
    
    const query3 = `
        SELECT 
            division_code, 
            gang_code,
            total_employees,
            total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        AND gang_code IN (${allPlaceholders})
    `;
    
    const rows3 = await extendDb.query<any>(query3, [month, year, ...allGangs]);
    
    // Group by our predefined division list
    const correctGrouping: Record<string, number> = {};
    for (const divCode of allDivisions) {
        correctGrouping[divCode] = 0;
    }
    
    for (const row of rows3) {
        const gangCode = row.gang_code;
        for (const divCode of allDivisions) {
            if (divisionGangs[divCode].includes(gangCode)) {
                correctGrouping[divCode] += (row.total_upah_bersih || 0);
                break;
            }
        }
    }
    
    console.log("\nCorrect grouping by gang assignment:");
    for (const [div, total] of Object.entries(correctGrouping)) {
        if (total > 0) {
            console.log(`  ${div.padEnd(10)}: ${total.toLocaleString('id-ID')}`);
        }
    }
    
    console.log("\n=== END DEBUG ===");
    process.exit(0);
}

debugP1A().catch(err => {
    console.error(err);
    process.exit(1);
});
