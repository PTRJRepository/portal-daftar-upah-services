import { Database } from "../db/client";

async function checkExtendDbSchema() {
    console.log("=== Checking extend_db_ptrj Database Schema ===\n");
    const db = Database.getExtendedInstance();

    try {
        // 1. List all tables
        console.log("--- ALL TABLES in extend_db_ptrj ---");
        const tables = await db.query(`
            SELECT TABLE_NAME, TABLE_TYPE 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_CATALOG = 'extend_db_ptrj'
            ORDER BY TABLE_NAME
        `);
        console.log(`Found ${tables.length} tables:`);
        tables.forEach((t: any) => console.log(`  - ${t.TABLE_NAME} (${t.TABLE_TYPE})`));

        // 2. For each table, get column details
        console.log("\n--- COLUMN DETAILS ---");
        for (const table of tables) {
            const columns = await db.query(`
                SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = '${table.TABLE_NAME}' AND TABLE_CATALOG = 'extend_db_ptrj'
                ORDER BY ORDINAL_POSITION
            `);
            console.log(`\n[Table: ${table.TABLE_NAME}] (${columns.length} columns)`);
            columns.forEach((c: any) => {
                const maxLen = c.CHARACTER_MAXIMUM_LENGTH ? `(${c.CHARACTER_MAXIMUM_LENGTH})` : '';
                console.log(`  ${c.COLUMN_NAME}: ${c.DATA_TYPE}${maxLen} | nullable=${c.IS_NULLABLE} | default=${c.COLUMN_DEFAULT || 'none'}`);
            });
        }

        // 3. Check employee_other_incomes data summary
        console.log("\n--- employee_other_incomes DATA SUMMARY ---");
        try {
            const summary = await db.query(`
                SELECT income_type, COUNT(*) as count, 
                       MIN(period_year) as min_year, MAX(period_year) as max_year,
                       MIN(period_month) as min_month, MAX(period_month) as max_month,
                       SUM(amount) as total_amount
                FROM employee_other_incomes
                GROUP BY income_type
            `);
            console.log("Income types:", JSON.stringify(summary, null, 2));
        } catch (e) {
            console.log("Table employee_other_incomes not found or empty");
        }

        // 4. Check employee_other_incomes_formulas
        console.log("\n--- employee_other_incomes_formulas ---");
        try {
            const formulas = await db.query(`SELECT * FROM employee_other_incomes_formulas`);
            console.log("Formulas:", JSON.stringify(formulas, null, 2));
        } catch (e) {
            console.log("Table not found");
        }

        // 5. Sample data from employee_other_incomes
        console.log("\n--- SAMPLE DATA (top 5 rows) ---");
        try {
            const sample = await db.query(`SELECT TOP 5 * FROM employee_other_incomes ORDER BY id DESC`);
            console.log(JSON.stringify(sample, null, 2));
        } catch (e) {
            console.log("No sample data");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
}

checkExtendDbSchema();
