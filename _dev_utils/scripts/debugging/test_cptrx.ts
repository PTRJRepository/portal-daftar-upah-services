import { Database } from '../src/db/client';

async function testCptrxSchema() {
    const db = Database.getInstance(undefined, "SERVER_PROFILE_2");
    console.log("--- Fetching one row from HR_CPTRX ---");
    try {
        const row = await db.query(`SELECT TOP 1 * FROM HR_CPTRX`);
        console.log("Columns in HR_CPTRX:");
        if (row.length > 0) {
            console.log(Object.keys(row[0]));
        }
    } catch (e) {
        console.error(e);
    }
}

testCptrxSchema();
