/**
 * Check if aggregation history has correct division_code for all gangs
 */

import { Database } from "./backend/src/db/client";

async function checkAggregationDivisionCodes() {
    const month = 3;
    const year = 2026;
    
    console.log("=== CHECK AGGREGATION DIVISION CODES ===\n");
    
    const extendDb = Database.getExtendedInstance();
    
    // Get all aggregation rows for March 2026
    const query = `
        SELECT 
            gang_code,
            division_code,
            total_employees,
            total_upah_bersih,
            total_premi,
            total_lembur
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        ORDER BY division_code, gang_code
    `;
    
    const rows = await extendDb.query<any>(query, [month, year]);
    
    console.log(`Found ${rows.length} total aggregation rows\n`);
    
    // Group by division_code
    const byDivision: Record<string, { count: number; gangs: string[]; total: number }> = {};
    
    for (const row of rows) {
        const divCode = row.division_code || 'NULL';
        if (!byDivision[divCode]) {
            byDivision[divCode] = { count: 0, gangs: [], total: 0 };
        }
        byDivision[divCode].count++;
        byDivision[divCode].gangs.push(row.gang_code);
        byDivision[divCode].total += (row.total_upah_bersih || 0);
    }
    
    console.log("Division breakdown:");
    for (const [div, data] of Object.entries(byDivision)) {
        console.log(`\n${div.padEnd(10)} | ${data.count.toString().padStart(3)} gangs | total=${data.total.toLocaleString('id-ID')}`);
        console.log(`           Gangs: ${data.gangs.sort().join(', ')}`);
    }
    
    // Check for potential issues
    console.log("\n\n=== POTENTIAL ISSUES ===");
    
    // P1A gangs that might be mislabeled
    const p1aExpectedGangs = ['A1H', 'A1M', 'A1P', 'A1T', 'A2M', 'A2P', 'A2T', 'A3H', 'A3M', 'A3P', 'A3T'];
    const p1aRows = rows.filter(r => p1aExpectedGangs.includes(r.gang_code));
    
    console.log("\nP1A expected gangs in aggregation:");
    for (const row of p1aRows) {
        const isCorrect = row.division_code === 'P1A';
        const status = isCorrect ? '✓' : '✗ WRONG';
        console.log(`  ${row.gang_code.padEnd(8)} -> ${row.division_code.padEnd(8)} ${status} (${(row.total_upah_bersih || 0).toLocaleString('id-ID')})`);
    }
    
    const p1aTotal = p1aRows.reduce((sum, r) => sum + (r.total_upah_bersih || 0), 0);
    console.log(`\nP1A Total: ${p1aTotal.toLocaleString('id-ID')} (Expected: 893.458.119)`);
    
    console.log("\n=== END ===");
    process.exit(0);
}

checkAggregationDivisionCodes().catch(err => {
    console.error(err);
    process.exit(1);
});
