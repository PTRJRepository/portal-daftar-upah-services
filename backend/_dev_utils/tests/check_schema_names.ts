import { Database } from "../../src/db/client";
import * as fs from "fs";

async function run() {
    const db = Database.getInstance();
    const result: any = { allowance_tables: [], special_columns: [] };

    try {
        const rows = await db.query(`SELECT TOP 10 name FROM sys.tables WHERE name LIKE '%ALLOWANCE%'`);
        result.allowance_tables = rows.map((r: any) => r.name);
    } catch (e: any) { console.error(e.message) }

    try {
        const tables = await db.query(`
            SELECT t.name as TableName, c.name as ColumnName
            FROM sys.columns c
            JOIN sys.tables t ON c.object_id = t.object_id
            WHERE c.name IN ('CompanyCode', 'CompCode', 'LocType')
              AND t.name IN ('HR_EMPLOYEE', 'HR_EMPLOYMENT', 'HR_GANG')
        `);
        result.special_columns = tables;
    } catch (e: any) { console.error(e.message) }

    fs.writeFileSync("_dev_utils/tests/schema_out.json", JSON.stringify(result, null, 2));
    process.exit(0);
}

run().catch(console.error);
