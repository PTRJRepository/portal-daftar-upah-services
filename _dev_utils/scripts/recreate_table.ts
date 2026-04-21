import { Database } from "./db/client";

async function run() {
    Database.getInstance();
    const db = Database.getExtendedInstance();
    try {
        console.log("Dropping and recreating table...");
        await db.query(`DROP TABLE employee_other_incomes_formulas;`);
        await db.query(`
            CREATE TABLE employee_other_incomes_formulas (
                income_type VARCHAR(50) PRIMARY KEY,
                formula_string VARCHAR(500) NOT NULL,
                is_paid_in_thp BIT DEFAULT 1,
                is_taxable BIT DEFAULT 1,
                updated_at DATETIME DEFAULT GETDATE()
            );
        `);
        await db.query(`
            INSERT INTO employee_other_incomes_formulas (income_type, formula_string, is_paid_in_thp, is_taxable) 
            VALUES ('THR', '(UPAH_DASAR * 30) + (BERAS_RATE * 30) + MASA_KERJA_JUMLAH', 1, 1);
        `);
        console.log("Done.");
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
