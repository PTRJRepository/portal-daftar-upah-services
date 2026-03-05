import { Database } from '../../backend/src/db/client';
import { Config } from '../../backend/src/config';
import fs from 'fs';
import path from 'path';

async function inspectLembur() {
    let output = "";
    try {
        const db = Database.getInstance('extend_db_ptrj', Config.DB_EXTEND_PROFILE || 'SERVER_PROFILE_1');

        output += "=== payroll_history_detail (Lembur > 0) ===\n";
        const rows = await db.query(`
            SELECT TOP 5 
                emp_name, gang_code, loc_code,
                lembur_jam, lembur_rate, lembur_jumlah, lembur_records
            FROM dbo.payroll_history_detail
            WHERE lembur_jumlah > 0
            ORDER BY id DESC
        `);
        output += JSON.stringify(rows, null, 2) + "\n\n";

        const outputPath = path.join(__dirname, 'inspect_lembur.txt');
        fs.writeFileSync(outputPath, output);
        console.log(`Successfully wrote to ${outputPath}`);
    } catch (e) {
        console.error("Failed:", e);
    }
}

inspectLembur();
