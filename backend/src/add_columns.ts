import { Database } from "./db/client";

async function run() {
    Database.getInstance();
    const db = Database.getExtendedInstance();
    try {
        console.log("Adding columns to employee_other_incomes_formulas...");
        await db.query(`
            ALTER TABLE employee_other_incomes_formulas 
            ADD is_paid_in_thp BIT DEFAULT 1, is_taxable BIT DEFAULT 1;
        `);
        console.log("Done.");
    } catch (e) {
        if (e.message && e.message.includes("already has a column")) {
            console.log("Columns already exist.");
        } else {
            console.error("Error:", e);
        }
    }
}
run();
