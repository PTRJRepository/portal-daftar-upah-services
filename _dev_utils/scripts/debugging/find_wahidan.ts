import { Database } from "../src/db/client";

async function findWahidanDuplicates() {
    const extDb = Database.getExtendedInstance();
    console.log("=== SEARCHING FOR WAHIDAN BY NAME ===");
    const records = await extDb.query(`
        SELECT id, nik, emp_name, division_code, gang_code, amount, income_name, updated_at
        FROM employee_other_incomes 
        WHERE emp_name LIKE '%WAHIDAN%' AND period_year = 2026 AND period_month = 2
    `);
    console.table(records);
}

findWahidanDuplicates();
