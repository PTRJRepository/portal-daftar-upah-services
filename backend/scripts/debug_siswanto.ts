import { Database } from "../src/db/client";

async function debugSiswanto() {
    const mainDb = Database.getInstance();
    const extDb = Database.getExtendedInstance();

    console.log("=== CHECKING employee_other_incomes ===");
    try {
        const cols = await extDb.query(`
            SELECT COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'employee_other_incomes'
        `);
        console.table(cols);

        const sisIncomes = await extDb.query(`
            SELECT * FROM employee_other_incomes 
            WHERE emp_name LIKE '%SISWANTO%'
        `);
        console.log("Siswanto records in other incomes:");
        console.table(sisIncomes);

        if (sisIncomes.length > 0) {
            const nik = sisIncomes[0].nik;
            console.log(`Searching for HR data for NIK: ${nik}`);
            
            const hrData = await mainDb.query(`
                SELECT RTRIM(e.EmpCode) as EmpCode, RTRIM(e.NewICNo) as NewICNo, RTRIM(e.EmpName) as EmpName, 
                       e.Status, em.AppJoinDate, em.AppJoinGrpDate, 
                       RTRIM(p.BankAccNo) as BankAccNo, RTRIM(p.BankCode) as BankCode,
                       RTRIM(gl.GangCode) as GangCode
                FROM HR_EMPLOYEE e
                LEFT JOIN HR_EMPLOYMENT em ON e.EmpCode = em.EmpCode
                LEFT JOIN HR_PAYROLL p ON e.EmpCode = p.EmpCode
                LEFT JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
                WHERE RTRIM(e.NewICNo) = ? OR RTRIM(e.EmpCode) = ? OR RTRIM(e.EmpName) LIKE '%SISWANTO%'
                ORDER BY em.AppJoinDate DESC
            `, [nik, nik]);
            console.log("HR Data found:");
            console.table(hrData);
        }
    } catch (e) {
        console.error(e);
    }
}

debugSiswanto();
