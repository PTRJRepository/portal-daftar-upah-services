import { Database } from "../../src/db/client";

async function checkSchema() {
    const db = Database.getExtendedInstance();
    
    console.log("TASKREG_SCHEMA_START");
    const taskregCols = await db.query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'history_taskreg'
        ORDER BY ORDINAL_POSITION
    `);
    console.log(JSON.stringify(taskregCols, null, 2));
    console.log("TASKREG_SCHEMA_END");

    console.log("\nADTRANS_SCHEMA_START");
    const adtransCols = await db.query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'history_adtrans'
        ORDER BY ORDINAL_POSITION
    `);
    console.log(JSON.stringify(adtransCols, null, 2));
    console.log("ADTRANS_SCHEMA_END");

    process.exit(0);
}

checkSchema().catch(console.error);
