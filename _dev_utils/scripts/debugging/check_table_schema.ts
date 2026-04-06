/**
 * Check daftar_upah_aggregation_history table schema
 */
import { Database } from "../../../backend/src/db/client";

async function checkSchema() {
    const db = Database.getExtendedInstance();

    const query = `
        SELECT
            COLUMN_NAME,
            DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH,
            NUMERIC_PRECISION,
            NUMERIC_SCALE,
            IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'daftar_upah_aggregation_history'
        ORDER BY ORDINAL_POSITION
    `;

    const results = await db.query(query);
    console.log('\n=== Table Schema ===');
    console.table(results);
}

checkSchema()
    .then(() => { console.log('\nDone'); process.exit(0); })
    .catch(e => { console.error(e); process.exit(1); });