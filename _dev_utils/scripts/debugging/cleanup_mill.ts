/**
 * Clean up bad MILL records
 */
import { Database } from "../../../backend/src/db/client";

async function cleanup() {
    const db = Database.getExtendedInstance();

    // Delete records where gang_code is literally the string 'null'
    const result = await db.query(`
        DELETE FROM dbo.daftar_upah_aggregation_history
        WHERE division_code = 'MILL'
          AND period_month = 3
          AND period_year = 2026
          AND (gang_code = 'null' OR gang_code IS NULL)
    `);
    console.log(`Deleted ${result.affectedRows} bad MILL records`);

    // Verify remaining records
    const remaining = await db.query(`
        SELECT id, gang_code, gang_description, total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE division_code = 'MILL'
          AND period_month = 3
          AND period_year = 2026
    `);
    console.log(`\nRemaining MILL records: ${remaining.length}`);
    remaining.forEach((r: any) => {
        console.log(`  ID: ${r.id}, gang: ${r.gang_code}, upah_bersih: ${r.total_upah_bersih}`);
    });
}

cleanup()
    .then(() => { console.log('\nDone'); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });