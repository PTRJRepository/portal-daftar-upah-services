import { Database } from '../../backend/src/db/client';
import * as fs from 'fs';

async function testMissingFields() {
    try {
        console.log("Starting missing fields test...");
        const db = Database.getExtendedInstance();
        
        let output = "=== Employee Other Incomes for M2 2026 ===\n";
        
        const rows = await db.query(`
            SELECT TOP 20 id, nik, emp_code, emp_name, income_type, income_name, amount 
            FROM employee_other_incomes 
            WHERE period_month = 2 AND period_year = 2026
        `) as any[];
        
        for (const r of rows) {
            output += JSON.stringify(r) + "\n";
        }
        
        output += "\n=== Employee Other Incomes for M1 2026 ===\n";
        
        const rows1 = await db.query(`
            SELECT TOP 20 id, nik, emp_code, emp_name, income_type, income_name, amount 
            FROM employee_other_incomes 
            WHERE period_month = 1 AND period_year = 2026
        `) as any[];
        
        for (const r of rows1) {
            output += JSON.stringify(r) + "\n";
        }
        
        fs.writeFileSync('../_dev_utils/scripts/test_other_incomes_out.txt', output, 'utf-8');
        console.log("Done");

    } catch (error) {
        console.error("Error running test:", error);
    }
}

testMissingFields().then(() => process.exit(0));
