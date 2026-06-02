// Probe Workerleave, Workerholidays, HR_LEAVETRX, HR_CPTRX_LEAVE schemas
import { Database } from "./src/db/client";

async function probe() {
    const stagingDb = Database.getStagingInstance();
    const prodDb = Database.getInstance();

    const tables = [
        { name: "Workerleave", db: stagingDb, catalog: "staging_PTRJ_iFES_Plantware" },
        { name: "Workerholidays", db: stagingDb, catalog: "staging_PTRJ_iFES_Plantware" },
        { name: "LeaveType", db: stagingDb, catalog: "staging_PTRJ_iFES_Plantware" },
        { name: "HR_LEAVETRX", db: prodDb, catalog: "db_ptrj" },
        { name: "HR_CPTRX_LEAVE", db: prodDb, catalog: "db_ptrj" },
    ];

    for (const t of tables) {
        console.log(`\n=== ${t.name} ===`);
        try {
            const cols = await t.db.query<any>(
                `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH as max_len, IS_NULLABLE
                 FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_NAME = '${t.name}' AND TABLE_CATALOG = '${t.catalog}'
                 ORDER BY ORDINAL_POSITION`
            );
            for (const c of cols) {
                console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE}${c.max_len ? '('+c.max_len+')' : ''}) ${c.IS_NULLABLE}`);
            }

            // Sample 3 rows
            const samples = await t.db.query<any>(
                `SELECT TOP 3 * FROM [${t.catalog}].[dbo].[${t.name}] ORDER BY 1 DESC`
            );
            console.log(`  Samples (${samples.length}):`);
            for (const s of samples) {
                console.log(`    ${JSON.stringify(s)}`);
            }
        } catch (e: any) {
            console.log(`  ERROR: ${e.message}`);
        }
    }
}

probe().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
