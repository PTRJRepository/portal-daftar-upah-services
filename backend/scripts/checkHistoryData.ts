import { Database } from "../src/db/client";
import { Config } from "../src/config";

async function run() {
    console.log("Checking history data...");
    const profile = Config.DB_PROFILE;
    Config.DEFAULT_DATABASE = "extend_db_ptrj";
    const db = Database.getInstance(undefined, profile);

    const data = await db.query(`
        SELECT TOP 10 
            emp_code, 
            emp_name, 
            total_premi, 
            premi_detail, 
            potongan_detail 
        FROM dbo.payroll_history_detail 
        WHERE master_id IN (
            SELECT id FROM dbo.payroll_history_header 
            WHERE period_month = 1 AND period_year = 2026
        )
        AND total_premi > 0
    `);

    console.log(JSON.stringify(data, null, 2));

    const dataPot = await db.query(`
        SELECT TOP 5
            emp_code, 
            emp_name, 
            total_premi, 
            premi_detail, 
            potongan_detail 
        FROM dbo.payroll_history_detail 
        WHERE master_id IN (
            SELECT id FROM dbo.payroll_history_header 
            WHERE period_month = 1 AND period_year = 2026
        )
    `);

    console.log("Random 5 rows:");
    console.log(JSON.stringify(dataPot, null, 2));
}

run().catch(console.error);
