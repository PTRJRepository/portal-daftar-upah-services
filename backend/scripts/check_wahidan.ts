import { Database } from "../src/db/client";

async function checkWahidan() {
    const extDb = Database.getExtendedInstance();
    const mainDb = Database.getInstance();

    const nik = '5208030508790001';
    console.log(`=== CHECKING WAHIDAN (NIK: ${nik}) ===`);

    const records = await extDb.query(`
        SELECT id, nik, emp_name, income_name, amount, division_code, gang_code 
        FROM employee_other_incomes 
        WHERE nik = ? AND income_type = 'THR' AND period_year = 2026 AND period_month = 2
    `, [nik]);

    console.log("Records in employee_other_incomes:");
    console.table(records);

    const hr = await mainDb.query(`
        SELECT RTRIM(e.EmpCode) as EmpCode, em.AppJoinDate, em.AppJoinGrpDate, e.Status
        FROM HR_EMPLOYEE e
        LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
        WHERE RTRIM(e.NewICNo) = ? OR RTRIM(e.EmpCode) = ?
    `, [nik, nik]);
    console.log("HR Data:");
    console.table(hr);
}

checkWahidan();
