import { Database } from "../db/client";
import { writeFileSync } from "fs";
import { join } from "path";

async function checkExtendDbSchema() {
    const output: string[] = [];
    const log = (msg: string) => { output.push(msg); console.log(msg); };

    log("=== Checking extend_db_ptrj Database Schema ===\n");
    const db = Database.getExtendedInstance();

    try {
        // 1. List all tables
        log("--- ALL TABLES in extend_db_ptrj ---");
        const tables = await db.query(`
            SELECT TABLE_NAME, TABLE_TYPE 
            FROM INFORMATION_SCHEMA.TABLES 
            ORDER BY TABLE_NAME
        `);
        log(`Found ${tables.length} tables:`);
        tables.forEach((t: any) => log(`  - ${t.TABLE_NAME} (${t.TABLE_TYPE})`));

        // 2. For each table, get column details
        log("\n--- COLUMN DETAILS ---");
        for (const table of tables) {
            const columns = await db.query(`
                SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = '${table.TABLE_NAME}'
                ORDER BY ORDINAL_POSITION
            `);
            log(`\n[Table: ${table.TABLE_NAME}] (${columns.length} columns)`);
            columns.forEach((c: any) => {
                const maxLen = c.CHARACTER_MAXIMUM_LENGTH ? `(${c.CHARACTER_MAXIMUM_LENGTH})` : '';
                log(`  ${c.COLUMN_NAME}: ${c.DATA_TYPE}${maxLen} | nullable=${c.IS_NULLABLE} | default=${c.COLUMN_DEFAULT || 'none'}`);
            });
        }

        // 3. Check employee_other_incomes data summary
        log("\n--- employee_other_incomes DATA SUMMARY ---");
        try {
            const summary = await db.query(`
                SELECT income_type, COUNT(*) as count, 
                       MIN(period_year) as min_year, MAX(period_year) as max_year,
                       MIN(period_month) as min_month, MAX(period_month) as max_month,
                       SUM(amount) as total_amount
                FROM employee_other_incomes
                GROUP BY income_type
            `);
            log("Income types:\n" + JSON.stringify(summary, null, 2));
        } catch (e) {
            log("Table employee_other_incomes not found or empty");
        }

        // 4. Check employee_other_incomes_formulas
        log("\n--- employee_other_incomes_formulas ---");
        try {
            const formulas = await db.query(`SELECT * FROM employee_other_incomes_formulas`);
            log("Formulas:\n" + JSON.stringify(formulas, null, 2));
        } catch (e) {
            log("Table not found");
        }

        // 5. Sample data from employee_other_incomes (recent)
        log("\n--- SAMPLE DATA (top 5 rows) ---");
        try {
            const sample = await db.query(`SELECT TOP 5 * FROM employee_other_incomes ORDER BY id DESC`);
            log(JSON.stringify(sample, null, 2));
        } catch (e) {
            log("No sample data");
        }

        // 6. Check distinct periods
        log("\n--- DISTINCT PERIODS ---");
        try {
            const periods = await db.query(`
                SELECT DISTINCT period_year, period_month, income_type
                FROM employee_other_incomes
                ORDER BY period_year DESC, period_month DESC
            `);
            log(JSON.stringify(periods, null, 2));
        } catch (e) {
            log("No period data");
        }

    } catch (e) {
        log("Error: " + String(e));
    }

    // Save full output to file
    const outputPath = join(import.meta.dir, "../../_dev_utils/extend_db_schema_output.txt");
    writeFileSync(outputPath, output.join("\n"), "utf-8");
    log(`\nOutput saved to ${outputPath}`);
    process.exit(0);
}

checkExtendDbSchema();
