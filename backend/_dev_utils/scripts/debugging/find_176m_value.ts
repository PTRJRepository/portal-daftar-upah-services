import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    const targetValue = 176414884;
    const tolerance = 1000; // Allow small rounding differences
    
    console.log(`=== SEARCHING FOR upah_bersih ≈ ${targetValue.toLocaleString('id-ID')} ===\n`);
    
    // Search across all gangs in March 2026
    const rows = await extDb.query<any>(`
        SELECT gang_code, division_code, total_employees, total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = 3 AND period_year = 2026
          AND total_upah_bersih BETWEEN ? AND ?
    `, [targetValue - tolerance, targetValue + tolerance]);
    
    if (rows.length > 0) {
        console.log(`Found ${rows.length} gang(s) with matching upah_bersih:\n`);
        for (const row of rows) {
            console.log(`  Gang: ${row.gang_code} | Division: ${row.division_code}`);
            console.log(`  Employees: ${row.total_employees}`);
            console.log(`  upah_bersih: ${(row.total_upah_bersih || 0).toLocaleString('id-ID')}`);
            console.log();
        }
    } else {
        console.log(`No gang found with upah_bersih ≈ ${targetValue.toLocaleString('id-ID')}`);
        console.log(`\nShowing top 10 highest upah_bersih values:\n`);
        
        const topRows = await extDb.query<any>(`
            SELECT TOP 10 gang_code, division_code, total_employees, total_upah_bersih
            FROM dbo.daftar_upah_aggregation_history
            WHERE period_month = 3 AND period_year = 2026
            ORDER BY total_upah_bersih DESC
        `);
        
        for (const row of topRows) {
            console.log(`  ${row.gang_code} (${row.division_code}): ${(row.total_upah_bersih || 0).toLocaleString('id-ID')} | emp: ${row.total_employees}`);
        }
    }
}

main().catch(console.error);
