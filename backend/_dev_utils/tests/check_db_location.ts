import { Database } from "../../src/db/client";
import { Config } from "../../src/config";

async function checkSchema() {
    // Check both databases
    const databases = [
        { name: "EXTEND", db: "extend_db_ptrj" },
        { name: "TRANS", db: "extend_db_ptrj_transaksi" }
    ];

    for (const dbInfo of databases) {
        console.log(`\nChecking database: ${dbInfo.name} (${dbInfo.db})`);
        const db = Database.getInstance(dbInfo.db, Config.DB_EXTEND_PROFILE);
        
        try {
            const tables = await db.query(`
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME IN ('history_taskreg', 'history_adtrans')
            `);
            console.log(`Tables found: ${tables.map((t: any) => t.TABLE_NAME).join(', ') || 'NONE'}`);
        } catch (e: any) {
            console.log(`Database ${dbInfo.db} not accessible: ${e.message}`);
        }
    }

    process.exit(0);
}

checkSchema().catch(console.error);
