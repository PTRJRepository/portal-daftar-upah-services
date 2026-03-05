import { Database } from '../../backend/src/db/client';
import { Config } from '../../backend/src/config';
import fs from 'fs';
import path from 'path';

async function listTables() {
    let output = "";
    try {
        const db1 = Database.getInstance('db_ptrj', Config.DB_PROFILE || 'SERVER_PROFILE_1');
        const rows1 = await db1.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'");
        output += "=== db_ptrj Tables ===\n";
        output += rows1.map((r: any) => r.TABLE_NAME).filter((n: string) => n.toLowerCase().includes('lembur') || n.toLowerCase().includes('ot') || n.toLowerCase().includes('hist') || n.toLowerCase().includes('upah')).join("\n");
        output += "\n";

        const db2 = Database.getInstance('extend_db_ptrj', Config.DB_EXTEND_PROFILE || 'SERVER_PROFILE_1');
        const rows2 = await db2.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'");
        output += "\n=== extend_db_ptrj Tables ===\n";
        output += rows2.map((r: any) => r.TABLE_NAME).filter((n: string) => n.toLowerCase().includes('lembur') || n.toLowerCase().includes('ot') || n.toLowerCase().includes('hist') || n.toLowerCase().includes('upah')).join("\n");

        const outputPath = path.join(__dirname, 'list_tables_output.txt');
        fs.writeFileSync(outputPath, output);
        console.log(`Successfully wrote to ${outputPath}`);
    } catch (e) {
        console.error("Failed:", e);
    }
}

listTables();
