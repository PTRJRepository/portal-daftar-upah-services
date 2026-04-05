import { Database } from "../../../src/db/client";

async function main() {
    const db = Database.getExtendedInstance();
    
    // Check aggregation history for March 2026
    const rows = await db.query<any>(`
        SELECT 
            division_code, 
            gang_code, 
            total_employees,
            total_pph21,
            total_potongan,
            total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = 3 AND period_year = 2026
        ORDER BY division_code, gang_code
    `);
    
    console.log(`Aggregation history for March 2026: ${rows.length} gangs\n`);
    
    let totalPph21 = 0;
    let countWithPph21 = 0;
    let countWithoutPph21 = 0;
    
    for (const row of rows) {
        const pph21 = row.total_pph21 || 0;
        totalPph21 += pph21;
        if (pph21 > 0) {
            countWithPph21++;
        } else {
            countWithoutPph21++;
        }
        console.log(`${row.division_code} | ${row.gang_code} | Employees: ${row.total_employees} | PPh21: ${pph21.toLocaleString('id-ID')}`);
    }
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total gangs: ${rows.length}`);
    console.log(`Gangs with PPh21 > 0: ${countWithPph21}`);
    console.log(`Gangs with PPh21 = 0: ${countWithoutPph21}`);
    console.log(`Total PPh21 in history: ${totalPph21.toLocaleString('id-ID')}`);
}

main().catch(console.error);
