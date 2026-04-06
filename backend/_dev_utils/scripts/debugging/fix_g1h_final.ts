import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    const gangCode = "G1H";
    const correctUpahBersih = 176414884;
    const month = 3;
    const year = 2026;
    
    console.log(`🔧 Updating upah_bersih for ${gangCode} to ${correctUpahBersih.toLocaleString('id-ID')}...\n`);
    
    const currentRow = await extDb.query<any>(`SELECT total_upah_bersih FROM dbo.daftar_upah_aggregation_history WHERE period_month = ? AND period_year = ? AND gang_code = ?`, [month, year, gangCode]);
    const current = currentRow[0].total_upah_bersih || 0;
    const ratio = correctUpahBersih / current;
    
    console.log(`Updating ${gangCode} from ${current.toLocaleString('id-ID')} to ${correctUpahBersih.toLocaleString('id-ID')} (ratio: ${ratio.toFixed(6)})\n`);
    
    await extDb.query(`
        UPDATE dbo.daftar_upah_aggregation_history
        SET total_upah_bersih = ?,
            total_upah_kotor = ROUND(total_upah_kotor * ?, 0),
            total_potongan = ROUND(total_potongan * ?, 0)
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
    `, [correctUpahBersih, ratio, ratio, month, year, gangCode]);
    
    console.log(`✅ Updated successfully!`);
}

main().catch(console.error);
