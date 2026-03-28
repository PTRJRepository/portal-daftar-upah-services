import { Database } from '../../backend/src/db/client';

async function check() {
    try {
        const db = Database.getExtendedInstance();
        console.log("Checking for THR records with unusual names in 2026...");
        const result = await db.query("SELECT DISTINCT income_name FROM employee_other_incomes WHERE period_year = 2026 AND income_type = 'THR' AND income_name NOT LIKE 'Tunjangan Hari Raya%'");
        console.log("Unusual names:", JSON.stringify(result, null, 2));
        
        console.log("\nChecking for ANY records in extend_db_ptrj..employee_other_incomes regardless of filters...");
        const count = await db.query("SELECT COUNT(*) as count FROM employee_other_incomes");
        console.log("Total records in table:", count);
    } catch (error) {
        console.error("Error:", error);
    }
}

check();
