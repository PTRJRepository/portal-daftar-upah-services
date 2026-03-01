import { Database } from './src/db/client';

async function checkHistoryTables() {
    const db = Database.getInstance();

    // 1. Check if HR_PAYROLL_ARC exists or any table with RiceRation
    try {
        const tables = await db.query(`
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE column_name = 'RiceRation'
        `);
        console.log("Tables with RiceRation column:", tables);
    } catch (e) {
        console.error("Error querying information_schema:", e);
    }
}

checkHistoryTables().catch(console.error);
