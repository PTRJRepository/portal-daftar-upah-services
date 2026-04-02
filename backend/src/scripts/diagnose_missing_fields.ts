
import { Database } from "../db/client";
import { OtherIncomesService } from "../services/otherIncomesService";
import { gangService } from "../services/gangService";
import { dataExtractorService } from "../services/dataExtractorService";
import { employeeEstateService } from "../services/employeeEstateService";

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
    const otherIncomes = await OtherIncomesService.getIncomes(year, month, undefined, 'ALL');
    const thrRecords = otherIncomes.filter((i: any) => i.income_type === 'THR');
    const kontanRecords = otherIncomes.filter((i: any) => i.income_type === 'KONTAN' || i.income_type === 'KONTANAN');

    console.log(`Total in DB - THR: ${thrRecords.length}, KONTAN: ${kontanRecords.length}`);

    if (kontanRecords.length > 0) {
        const sampleK = kontanRecords[0];
        console.log(`Sample KONTAN record: NIK=${sampleK.nik}, Name=${sampleK.emp_name}, Amount=${sampleK.amount}, Type=${sampleK.income_type}`);
        
        // Find which gang this employee belongs to
        const empCode = sampleK.emp_code || '';
        const nik = sampleK.nik || '';
        
        const empGangInfo = await dbMain.query<any>(`
            SELECT TOP 1 RTRIM(GangCode) as GangCode FROM HR_GANGLN WHERE GangMember = ? OR GangMember = (SELECT EmpCode FROM HR_EMPLOYEE WHERE NewICNo = ?)
        `, [empCode, nik]);
        
        if (empGangInfo.length > 0) {
            const targetGang = empGangInfo[0].GangCode;
            console.log(`Employee belongs to gang: ${targetGang}. Re-diagnosing for this gang.`);
            
            // 5. Test dataExtractorService for the TARGET gang
            console.log(`Step 5: Testing extractPayrollData for gang ${targetGang}...`);
            const result = await dataExtractorService.extractPayrollData(month, year, targetGang);
            const dataRows = result.data_rows;
            
            const rowsWithKontan = dataRows.filter(r => r.pendapatan_kontan !== undefined || (r as any).pendapatan_kontanan !== undefined || (r as any).pendapatan_kontan > 0);
            console.log(`Rows with any KONTAN field: ${rowsWithKontan.length}`);
            
            if (rowsWithKontan.length > 0) {
                console.log("Matched rows with KONTAN:");
                rowsWithKontan.forEach(r => {
                    console.log({
                        emp_code: r.emp_code,
                        nama: r.nama,
                        pendapatan_kontan: r.pendapatan_kontan,
                        pendapatan_kontanan: (r as any).pendapatan_kontanan
                    });
                });
            } else {
                console.log("FAIL: Even though we found an employee with KONTAN in this gang, they don't have KONTAN in extractPayrollData output.");
                // Let's debug why
                const targetEmp = dataRows.find(r => r.emp_code === empCode || r.nik === nik);
                if (targetEmp) {
                    console.log("Target employee found in data_rows, but no KONTAN fields present.");
                    console.log("Fields present:", Object.keys(targetEmp).filter(k => k.startsWith('pendapatan_')));
                } else {
                    console.log(`Target employee ${empCode}/${nik} NOT found in gang ${targetGang} for period ${month}/${year}`);
                }
            }
        }
    }
}

diagnose().catch(console.error).finally(() => process.exit());
