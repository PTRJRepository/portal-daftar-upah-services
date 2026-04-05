import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    
    // Check actual stored values
    const rows = await extDb.query<any>(`
        SELECT TOP 20 id, gang_code, 
               total_upah_kotor, total_potongan, total_upah_bersih,
               total_pph21, total_bpjs_pekerja, total_spsi, total_koreksi
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = 3 AND period_year = 2026
        ORDER BY gang_code
    `);
    
    console.log("Checking upah_bersih calculation in aggregation history:\n");
    console.log("Formula seharusnya: upah_bersih = upah_kotor - potongan\n");
    
    for (const row of rows) {
        const kotor = row.total_upah_kotor || 0;
        const potongan = row.total_potongan || 0;
        const stored = row.total_upah_bersih || 0;
        const calculated = kotor - potongan;
        const diff = stored - calculated;
        const marker = Math.abs(diff) > 1 ? '⚠️' : '✅';
        
        console.log(`${marker} ${row.gang_code}: kotor=${kotor.toLocaleString('id-ID')} | potongan=${potongan.toLocaleString('id-ID')} | stored=${stored.toLocaleString('id-ID')} | should_be=${calculated.toLocaleString('id-ID')} | diff=${diff.toLocaleString('id-ID')}`);
    }
}

main().catch(console.error);
