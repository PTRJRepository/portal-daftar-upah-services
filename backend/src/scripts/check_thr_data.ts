import { Database } from "../db/client";

/**
 * Check saved THR data details - find proportional workers
 */

const db = Database.getExtendedInstance();

async function checkData() {
    console.log("=== Checking Saved THR Data for Proportional Workers ===\n");

    const rows = await db.query(`
        SELECT TOP 100 nik, emp_name, period_year, period_month, income_type, amount, income_name, details_json
        FROM employee_other_incomes
        WHERE income_type = 'THR' AND period_year = 2026 AND period_month = 2
        ORDER BY nik
    `);

    console.log(`Found ${rows.length} records\n`);

    let fullCount = 0;
    let propCount = 0;
    let noDetailsCount = 0;

    for (const r of rows) {
        let isProp = false;
        let propFactor = '12/12';

        if (r.details_json) {
            try {
                const details = JSON.parse(r.details_json);
                const vars = details.variables || {};
                propFactor = vars.PROPORTION_FACTOR || '12/12';
                if (propFactor !== '12/12') {
                    isProp = true;
                }
            } catch (e) {
                console.log(`ERROR parsing: ${e.message}`);
            }
        } else {
            noDetailsCount++;
            // Check income_name for proportion
            if (r.income_name && r.income_name.includes('Proporsi')) {
                isProp = true;
            }
        }

        if (isProp) {
            propCount++;
            console.log(`PROP: NIK=${r.nik}, name=${r.emp_name}, income_name=${r.income_name}, propFactor=${propFactor}`);
        } else {
            fullCount++;
        }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Full: ${fullCount}`);
    console.log(`Prop: ${propCount}`);
    console.log(`No details_json: ${noDetailsCount}`);
}

checkData();
