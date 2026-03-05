import { Database } from '../../backend/src/db/client';
import { Config } from '../../backend/src/config';
import fs from 'fs';
import path from 'path';

async function inspectTables() {
    let output = "";
    try {
        const db = Database.getInstance('extend_db_ptrj', Config.DB_EXTEND_PROFILE || 'SERVER_PROFILE_1');

        output += "=== payroll_history_detail ===\n";
        const rows1 = await db.query("SELECT TOP 5 * FROM dbo.payroll_history_detail ORDER BY id DESC");
        output += JSON.stringify(rows1, null, 2) + "\n\n";

        output += "=== history_taskreg ===\n";
        const rows2 = await db.query("SELECT TOP 5 * FROM dbo.history_taskreg ORDER BY id DESC");
        output += JSON.stringify(rows2, null, 2) + "\n\n";

        output += "=== history_adtrans ===\n";
        const rows3 = await db.query("SELECT TOP 5 * FROM dbo.history_adtrans ORDER BY id DESC");
        output += JSON.stringify(rows3, null, 2) + "\n\n";

        const outputPath = path.join(__dirname, 'inspect_history_tables.txt');
        fs.writeFileSync(outputPath, output);
        console.log(`Successfully wrote to ${outputPath}`);
    } catch (e) {
        console.error("Failed:", e);
    }
}

inspectTables();
