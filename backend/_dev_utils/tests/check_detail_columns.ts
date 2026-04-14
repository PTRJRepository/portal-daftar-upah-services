/**
 * Check what column names exist in payroll_history_detail
 */
import { Database } from "../../src/db/client";

import { writeFileSync } from "fs";

async function check() {
    const db = Database.getExtendedInstance();
    const result: any = {};
    
    // Get one sample row
    const rows = await db.query<any>(`
        SELECT TOP 1 * FROM dbo.payroll_history_detail WHERE master_id = 4184
    `);
    
    
    if (rows.length > 0) {
        result.columns = Object.keys(rows[0]);
        result.sample = {};
        for (const [k, v] of Object.entries(rows[0])) {
            if (k.toLowerCase().includes('nik') || k.toLowerCase().includes('emp') || k.toLowerCase().includes('gang')) {
                result.sample[k] = v;
            }
        }
    }
    
    // Check for dups in master 4184
    const dupes = await db.query<any>(`
        SELECT nik, emp_code, gang_code, COUNT(*) as cnt
        FROM dbo.payroll_history_detail 
        WHERE master_id = 4184
        GROUP BY nik, emp_code, gang_code
        HAVING COUNT(*) > 1
    `);
    result.duplicates_in_4184 = dupes;
    
    writeFileSync("_dev_utils/tests/column_check.json", JSON.stringify(result, null, 2));
    console.log("Done");
    process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
