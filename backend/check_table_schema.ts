import { Database } from "./src/db/client";

async function checkSchema() {
    const db = Database.getInstance();
    
    console.log("\n=== PR_TASKREGLN columns ===");
    const taskregCols = await db.query<any>(`
        SELECT TOP 1 * FROM PR_TASKREGLN
    `, []);
    if (taskregCols.length > 0) {
        console.log("Columns:", Object.keys(taskregCols[0]).join(', '));
    }
    
    console.log("\n=== PR_ADTRANSLN columns ===");
    const adtransCols = await db.query<any>(`
        SELECT TOP 1 * FROM PR_ADTRANSLN
    `, []);
    if (adtransCols.length > 0) {
        console.log("Columns:", Object.keys(adtransCols[0]).join(', '));
    }
    
    process.exit(0);
}

checkSchema().catch(err => {
    console.error(err);
    process.exit(1);
});
