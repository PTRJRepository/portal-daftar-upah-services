import { Database } from "../../backend/src/db/client";
import { Config } from "../../backend/src/config";
import { writeFileSync } from "fs";

async function main() {
    const db = Database.getInstance(Config.DEFAULT_DATABASE, Config.DB_PROFILE);
    const lines: string[] = [];

    for (const table of ['PR_WAGES', 'PR_EMPWAGES', 'PR_EMPWAGES_ARC']) {
        lines.push(`\n=== ${table} COLUMNS ===`);
        try {
            const cols = await db.query<any>(
                `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
                [table]
            );
            if (cols.length === 0) {
                lines.push(`(table not found or no columns)`);
            } else {
                cols.forEach((c: any) => lines.push(`  ${c.COLUMN_NAME} (${c.DATA_TYPE}, nullable=${c.IS_NULLABLE})`));
            }
        } catch (err: any) {
            lines.push(`Error: ${err.message}`);
        }
    }

    // Get sample from PR_EMPWAGES
    lines.push(`\n=== PR_EMPWAGES SAMPLE TOP 1 ===`);
    try {
        const sample = await db.query<any>(`SELECT TOP 1 * FROM PR_EMPWAGES`, {});
        if (sample.length > 0) {
            const keys = Object.keys(sample[0]);
            lines.push(`Columns: ${keys.join(', ')}`);
            keys.forEach(k => lines.push(`  ${k} = ${JSON.stringify(sample[0][k])}`));
        } else {
            lines.push(`No data`);
        }
    } catch (err: any) {
        lines.push(`Error: ${err.message}`);
    }

    // Get sample from PR_WAGES  
    lines.push(`\n=== PR_WAGES SAMPLE TOP 1 ===`);
    try {
        const sample = await db.query<any>(`SELECT TOP 1 * FROM PR_WAGES`, {});
        if (sample.length > 0) {
            const keys = Object.keys(sample[0]);
            lines.push(`Columns: ${keys.join(', ')}`);
            keys.forEach(k => lines.push(`  ${k} = ${JSON.stringify(sample[0][k])}`));
        } else {
            lines.push(`No data`);
        }
    } catch (err: any) {
        lines.push(`Error: ${err.message}`);
    }

    const output = lines.join('\n');
    writeFileSync('_dev_utils/tests/schema_result.txt', output, 'utf8');
    console.log("Written to _dev_utils/tests/schema_result.txt");
    process.exit(0);
}

main();
