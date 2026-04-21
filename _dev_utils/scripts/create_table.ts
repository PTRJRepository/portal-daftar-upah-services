import { Database } from "./db/client";

async function run() {
    console.log("Starting...");
    Database.getInstance();
    const db = Database.getExtendedInstance();
    try {
        console.log("Checking formulas table...");
        const check = await db.query(`SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'employee_other_incomes_formulas'`);
        console.log("Check:", check);
        if (check && check.length > 0 && check[0].count === 0) {
            console.log("Creating table...");
            await db.query(`
                    CREATE TABLE employee_other_incomes_formulas (
                        income_type VARCHAR(50) PRIMARY KEY,
                        formula_string VARCHAR(500) NOT NULL,
                        updated_at DATETIME DEFAULT GETDATE()
                    );
            `);
            console.log("Inserting default...");
            await db.query(`
                    INSERT INTO employee_other_incomes_formulas (income_type, formula_string) 
                    VALUES ('THR', '(UPAH_DASAR * 30) + (BERAS_RATE * 30) + MASA_KERJA_JUMLAH');
            `);
        } else {
            console.log("Table exists or query blocked", check);
        }

        const thrCheck = await db.query("SELECT * FROM employee_other_incomes_formulas WHERE income_type = 'THR'");
        console.log("THR Config present?", thrCheck);

        console.log("Done.");
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
