import { Database } from "../src/db/client";

async function checkWahidanDeep() {
    const extDb = Database.getExtendedInstance();
    const nik = '5208030508790001';
    
    console.log(`=== DEEP CHECK WAHIDAN (NIK: ${nik}) ===`);

    const records = await extDb.query(`
        SELECT * FROM employee_other_incomes 
        WHERE nik = ? AND income_type = 'THR' AND period_year = 2026 AND period_month = 2
    `, [nik]);

    console.log("Records Found:", records.length);
    if (records.length > 0) {
        console.log(JSON.stringify(records[0], null, 2));
    }
}

checkWahidanDeep();
