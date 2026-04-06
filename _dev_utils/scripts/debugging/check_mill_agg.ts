/**
 * Check ALL MILL aggregation records
 */
import { Database } from "../../../backend/src/db/client";

async function checkMillAgg() {
    const db = Database.getExtendedInstance();

    // Get ALL records for MILL in March 2026
    const query = `
        SELECT
            id, division_code, gang_code, gang_description,
            total_employees, total_hk,
            total_gaji_pokok, total_lembur, total_tunjangan,
            total_upah_kotor, total_potongan,
            total_pph21, total_spsi,
            total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE division_code = 'MILL'
          AND period_month = 3
          AND period_year = 2026
        ORDER BY id DESC
    `;

    const results = await db.query(query);
    console.log('\n=== ALL MILL Records (March 2026) ===');
    console.log(`Found ${results.length} record(s)`);
    results.forEach((r, i) => {
        console.log(`\nRecord ${i + 1}:`);
        console.log(`  gang_code: "${r.gang_code}"`);
        console.log(`  gang_description: "${r.gang_description}"`);
        console.log(`  employees: ${r.total_employees}`);
        console.log(`  HK: ${r.total_hk}`);
        console.log(`  Gaji Pokok: ${r.total_gaji_pokok}`);
        console.log(`  Upah Kotor: ${r.total_upah_kotor}`);
        console.log(`  Upah Bersih: ${r.total_upah_bersih}`);
    });
}

checkMillAgg()
    .then(() => { console.log('\nDone'); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });