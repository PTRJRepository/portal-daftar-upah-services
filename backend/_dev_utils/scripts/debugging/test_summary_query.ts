import { Database } from "../../../src/db/client";

async function main() {
    const db = Database.getExtendedInstance();
    
    // Test exact query that summaryService uses
    const query = `
        SELECT
            h.gang_code,
            h.division_code,
            ISNULL(h.total_premi, 0) as total_premi,
            ISNULL(h.total_employees, 0) as total_employees,
            ISNULL(h.total_hk, 0) as total_hk,
            ISNULL(h.total_upah_bersih, 0) as total_upah_bersih,
            ISNULL(h.total_pph21, 0) as total_pph21,
            ISNULL(h.total_spsi, 0) as total_spsi,
            ISNULL(h.total_lembur, 0) as total_lembur
        FROM dbo.daftar_upah_aggregation_history h
        WHERE h.period_month = 3 AND h.period_year = 2026
        ORDER BY h.division_code, h.gang_code
    `;
    
    const rows = await db.query<any>(query, []);
    
    console.log(`Query returned ${rows.length} rows\n`);
    
    // Group by division_code
    const divMap: Record<string, number> = {};
    for (const row of rows) {
        const div = row.division_code || 'UNKNOWN';
        divMap[div] = (divMap[div] || 0) + (row.total_pph21 || 0);
    }
    
    console.log("PPh21 per division_code:\n");
    let grandTotal = 0;
    for (const [div, pph21] of Object.entries(divMap).sort()) {
        grandTotal += pph21;
        console.log(`  ${div}: ${pph21.toLocaleString('id-ID')}`);
    }
    
    console.log(`\nGrand Total PPh21: ${grandTotal.toLocaleString('id-ID')}`);
    console.log(`\nSample rows with PPh21 > 0:`);
    
    const sampleRows = rows.filter(r => r.total_pph21 > 0).slice(0, 5);
    for (const row of sampleRows) {
        console.log(`  ${row.division_code} | ${row.gang_code} | PPh21: ${row.total_pph21.toLocaleString('id-ID')}`);
    }
}

main().catch(console.error);
