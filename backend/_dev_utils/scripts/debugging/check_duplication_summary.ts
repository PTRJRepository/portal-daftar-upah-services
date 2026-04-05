import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    
    // Check for duplicate gang records
    const dups = await extDb.query<any>(`
        SELECT gang_code, COUNT(*) as cnt, 
               SUM(total_upah_bersih) as sum_upah_bersih,
               MAX(total_upah_bersih) as max_upah_bersih,
               MIN(total_upah_bersih) as min_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = 3 AND period_year = 2026
        GROUP BY gang_code
        ORDER BY gang_code
    `);
    
    console.log("Aggregation records per gang (March 2026):\n");
    for (const row of dups) {
        const marker = row.cnt > 1 ? '⚠️ DUPLICATE' : '✅';
        console.log(`${marker} ${row.gang_code}: ${row.cnt} records | sum=${(row.sum_upah_bersih || 0).toLocaleString('id-ID')} | max=${(row.max_upah_bersih || 0).toLocaleString('id-ID')} | min=${(row.min_upah_bersih || 0).toLocaleString('id-ID')}`);
    }
}

main().catch(console.error);
