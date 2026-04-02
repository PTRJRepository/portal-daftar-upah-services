
import { Database } from "./backend/src/db/client";
import { OtherIncomesService } from "./backend/src/services/otherIncomesService";
import { gangService } from "./backend/src/services/gangService";
import { dataExtractorService } from "./backend/src/services/dataExtractorService";
import { employeeEstateService } from "./backend/src/services/employeeEstateService";

async function diagnose() {
    const gangCode = 'H1H';
    const month = 3;
    const year = 2026;

    console.log(`Diagnosing for Gang: ${gangCode}, Period: ${month}/${year}`);

    const db = Database.getExtendedInstance();
    const dbMain = Database.getInstance();

    // 1. Get employees in the gang
    const gangEmployees = await dbMain.query<any>(`
        SELECT 
            RTRIM(e.EmpCode) as emp_code,
            RTRIM(e.NewICNo) as nik,
            RTRIM(e.EmpName) as emp_name,
            RTRIM(gl.GangCode) as gang_code
        FROM HR_EMPLOYEE e
        INNER JOIN HR_GANGLN gl ON e.EmpCode = gl.GangMember
        WHERE gl.GangCode = ?
    `, [gangCode]);

    console.log(`Step 1: Found ${gangEmployees.length} employees in gang ${gangCode}`);

    if (gangEmployees.length === 0) return;

    const empCodes = gangEmployees.map((e: any) => e.emp_code);
    const niks = gangEmployees.map((e: any) => (e.nik || '').trim().toUpperCase()).filter(Boolean);

    // 2. Check employee_estate (JABATAN)
    const estateRows = await db.query<any>(`
        SELECT empcode, jabatan FROM employee_estate 
        WHERE empcode IN (${empCodes.map(() => '?').join(',')})
    `, empCodes);
    console.log(`Step 2a: Found ${estateRows.length} jabatan records in employee_estate`);

    // 3. Check history_hr_employee (HISTORICAL JABATAN)
    const historyHrRows = await db.query<any>(`
        SELECT emp_code, position FROM history_hr_employee
        WHERE emp_code IN (${empCodes.map(() => '?').join(',')})
        AND period_month = ? AND period_year = ?
    `, [...empCodes, month, year]);
    console.log(`Step 2b: Found ${historyHrRows.length} jabatan records in history_hr_employee`);

    // 4. Check employee_other_incomes (THR + KONTAN)
    const otherIncomes = await OtherIncomesService.getIncomes(year, month, undefined, gangCode);
    const thrRecords = otherIncomes.filter((i: any) => i.income_type === 'THR');
    const kontanRecords = otherIncomes.filter((i: any) => i.income_type === 'KONTAN' || i.income_type === 'KONTANAN');

    console.log(`Step 3: Found ${thrRecords.length} THR records for this gang`);
    console.log(`Step 4: Found ${kontanRecords.length} KONTAN records for this gang`);

    // 5. Test dataExtractorService
    console.log(`Step 5: Testing extractPayrollData...`);
    const result = await dataExtractorService.extractPayrollData(month, year, gangCode);
    const sample = result.data_rows.slice(0, 3);
    
    console.log("Sample rows from extractPayrollData:");
    sample.forEach(row => {
        console.log({
            emp_code: row.emp_code,
            nama: row.nama,
            jabatan_estate: row.jabatan_estate,
            pendapatan_thr: row.pendapatan_thr,
            pendapatan_kontan: row.pendapatan_kontan || (row as any).pendapatan_kontanan
        });
    });
}

diagnose().catch(console.error).finally(() => process.exit());
