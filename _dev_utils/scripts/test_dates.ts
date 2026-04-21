import { Database } from './src/db/client';

async function test() {
    const db = Database.getInstance();
    const rows = await db.query(`
        SELECT DISTINCT AccMonth, AccYear 
        FROM PR_GANGLN_ARC 
        WHERE MasterID IN (SELECT ID FROM PR_GANG WHERE GangID = 'F1BHL')
    `);
    console.log(rows);
    process.exit(0);
}
test();
