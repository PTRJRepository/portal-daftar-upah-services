import { Database } from "./src/db/client";

async function run() {
    const db = Database.getInstance();

    const tables = [
        'HR_EMPLOYEE',
        'HR_GANGLN',
        'HR_GANG',
        'PR_GANG',
        'PR_GANGLN_ARC',
        'PR_TASKREG',
        'PR_TASKREGLN',
        'PR_ADTRANS',
        'PR_ADTRANSLN'
    ];

    for (const table of tables) {
        console.log(`=== ${table} ===`);
        try {
            const rows = await db.query(`SELECT TOP 1 * FROM [db_ptrj].[dbo].[${table}]`);
            if (rows.length > 0) {
                console.log(Object.keys(rows[0]).join(', '));
            } else {
                console.log("(Empty table)");
                // Try getting columns from information_schema
                const cols = await db.query(`
                    SELECT COLUMN_NAME 
                    FROM information_schema.columns 
                    WHERE table_name = ?
                `, [table]);
                console.log(cols.map(c => c.COLUMN_NAME).join(', '));
            }
        } catch (err) {
            console.log(`Error checking table ${table}:`, err.message);
        }
        console.log("");
    }

    process.exit(0);
}

run().catch(console.error);
