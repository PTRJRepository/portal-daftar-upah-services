import { Database } from "../../src/db/client";

async function checkIds() {
    const db = Database.getInstance();
    
    console.log("Checking max IDs in source tables...");
    const taskregMax = await db.query(`
        SELECT MAX(ID) as max_id FROM PR_TASKREG
    `);
    const taskregArcMax = await db.query(`
        SELECT MAX(ID) as max_id FROM PR_TASKREG_ARC
    `);
    const adtransMax = await db.query(`
        SELECT MAX(ID) as max_id FROM PR_ADTRANS
    `);
    const adtransArcMax = await db.query(`
        SELECT MAX(ID) as max_id FROM PR_ADTRANS_ARC
    `);

    console.log("PR_TASKREG Max ID:", taskregMax[0].max_id);
    console.log("PR_TASKREG_ARC Max ID:", taskregArcMax[0].max_id);
    console.log("PR_ADTRANS Max ID:", adtransMax[0].max_id);
    console.log("PR_ADTRANS_ARC Max ID:", adtransArcMax[0].max_id);

    process.exit(0);
}

checkIds().catch(console.error);
