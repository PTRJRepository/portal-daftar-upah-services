import { Database } from '../../backend/src/db/client';
import { Config } from '../../backend/src/config';
import fs from 'fs';
import path from 'path';

async function inspectHistory() {
    const extendDb = Database.getInstance("extend_db_ptrj", Config.DB_EXTEND_PROFILE || "SERVER_PROFILE_1");
    let output = "Fetching sample data from daftar_upah_aggregation_history...\n";

    try {
        const rows = await extendDb.query(`
            SELECT TOP 5 
                period_year, period_month, division_code, gang_code, 
                dynamic_premi_data, informasi_tambahan,
                total_upah_bersih, total_hk, total_lembur
            FROM dbo.daftar_upah_aggregation_history
            WHERE total_lembur > 0 OR dynamic_premi_data IS NOT NULL
            ORDER BY period_year DESC, period_month DESC
        `);

        output += `Found ${rows.length} rows.\n`;
        for (const row of rows) {
            output += "--------------------------------------------------\n";
            output += `Period: ${row.period_year}-${row.period_month} | Div: ${row.division_code} | Gang: ${row.gang_code}\n`;
            output += `Upah Bersih: ${row.total_upah_bersih} | HK: ${row.total_hk} | Lembur: ${row.total_lembur}\n`;

            if (row.dynamic_premi_data) {
                output += "--- dynamic_premi_data ---\n";
                try {
                    const parsed = JSON.parse(row.dynamic_premi_data);
                    output += JSON.stringify(parsed, null, 2) + "\n";
                } catch (e) {
                    output += "Failed to parse dynamic_premi_data: " + row.dynamic_premi_data + "\n";
                }
            }

            if (row.informasi_tambahan) {
                output += "--- informasi_tambahan ---\n";
                try {
                    const parsed = JSON.parse(row.informasi_tambahan);
                    output += JSON.stringify(parsed, null, 2) + "\n";
                } catch (e) {
                    output += "Failed to parse informasi_tambahan: " + row.informasi_tambahan + "\n";
                }
            }
            output += "--------------------------------------------------\n";
        }

        const outputPath = path.join(__dirname, 'history_inspection_output.txt');
        fs.writeFileSync(outputPath, output);
        console.log(`Successfully wrote to ${outputPath}`);
    } catch (e) {
        console.error("Query failed:", e);
    }
}

inspectHistory();
