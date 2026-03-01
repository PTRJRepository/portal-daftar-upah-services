import { Database } from './src/db/client';
import { Config } from './src/config';

async function checkExtendDbHistorySchema() {
    const extendDb = Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);

    try {
        const rows = await extendDb.query(`
            SELECT TOP 1 *
            FROM dbo.history_hr_employee
        `);
        if (rows.length > 0) {
            console.log("Columns:", Object.keys(rows[0]));
        } else {
            console.log("No data found, checking schema...");
            const columns = await extendDb.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'history_hr_employee'
            `);
            console.log("Columns:", columns.map((c: any) => c.column_name));
        }
    } catch (e) {
        console.error("Error querying extend_db_ptrj:", e);
    }
}

checkExtendDbHistorySchema().catch(console.error);
