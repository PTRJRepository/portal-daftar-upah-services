import { Database } from '../../backend/src/db/client';

async function check() {
    try {
        const db = Database.getExtendedInstance();
        const rows = await db.query('SELECT TOP 10 details_json FROM employee_other_incomes WHERE income_type = \'THR\'');
        
        console.log("Inspecting variables in details_json...");
        rows.forEach((r, i) => {
            if (r.details_json) {
                try {
                    const data = JSON.parse(r.details_json);
                    const vars = data.variables || {};
                    console.log(`Row ${i} keys:`, Object.keys(vars));
                    console.log(`Row ${i} sample values:`, JSON.stringify(vars, null, 2));
                } catch (e) {}
            }
        });
    } catch (error) {
        console.error("Error:", error);
    }
}

check();
