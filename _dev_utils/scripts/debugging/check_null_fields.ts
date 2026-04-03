
import { Database } from "../db/client";

async function checkNullFields() {
    const db = Database.getExtendedInstance();
    try {
        const result = await db.query<any>(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN emp_code IS NULL THEN 1 ELSE 0 END) as null_emp_code,
                SUM(CASE WHEN gang_code IS NULL OR gang_code = '' THEN 1 ELSE 0 END) as null_gang_code,
                SUM(CASE WHEN division_code IS NULL OR division_code = '' THEN 1 ELSE 0 END) as null_division_code
            FROM employee_other_incomes
            WHERE income_type = 'THR'
        `);
        console.log('THR records analysis:', result[0]);
        
        const sample = await db.query<any>(`
            SELECT TOP 5 nik, emp_name, emp_code, gang_code, division_code 
            FROM employee_other_incomes 
            WHERE income_type = 'THR' AND (emp_code IS NULL OR gang_code IS NULL)
        `);
        console.log('Sample THR records with NULLs:', sample);
    } catch (e) {
        console.error(e);
    }
}

checkNullFields().then(() => process.exit());
