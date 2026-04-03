import { Database } from "../../../src/db/client";

async function main() {
    const db = Database.getExtendedInstance();

    // Check if version_index exists in the table schema
    const cols = await db.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'daftar_upah_aggregation_history'
        AND TABLE_SCHEMA = 'dbo'
        ORDER BY ORDINAL_POSITION
    `);
    console.log('Columns in daftar_upah_aggregation_history:');
    cols.forEach((c: any) => console.log(' -', c.COLUMN_NAME));

    // Check if there are duplicate gang_code for the same period (would indicate multiple versions)
    const dups = await db.query(`
        SELECT gang_code, period_month, period_year, COUNT(*) as cnt
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = 3 AND period_year = 2026
        GROUP BY gang_code, period_month, period_year
        HAVING COUNT(*) > 1
    `);
    console.log(`\nDuplicate gang_code in March 2026: ${dups.length}`);
    dups.forEach((d: any) => console.log(`  ${d.gang_code}: ${d.cnt} versions`));
}

main().catch(console.error);