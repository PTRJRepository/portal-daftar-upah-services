
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
        console.log(`Searching for a gang with KONTAN data among ${kontanRecords.length} records...`);
        
        let targetGang = '';
        let matchedEmp: any = null;

        for (const k of kontanRecords) {
            const empCode = k.emp_code || '';
            const nik = k.nik || '';
            
            const empGangInfo = await dbMain.query<any>(`
                SELECT TOP 1 RTRIM(GangCode) as GangCode FROM HR_GANGLN 
                WHERE GangMember = ? OR GangMember IN (SELECT EmpCode FROM HR_EMPLOYEE WHERE NewICNo = ?)
            `, [empCode, nik]);
            
            if (empGangInfo.length > 0) {
                targetGang = empGangInfo[0].GangCode;
                matchedEmp = k;
                break;
            }
        }

        if (targetGang) {
            console.log(`Found! Employee ${matchedEmp.emp_name} (${matchedEmp.nik}/${matchedEmp.emp_code}) belongs to gang: ${targetGang}.`);
            console.log(`Amount: ${matchedEmp.amount}, Type: ${matchedEmp.income_type}`);
            
            // Let's also check if this specific employee exists in HR_EMPLOYEE and what their codes are
            const empCodesFromNik = await dbMain.query<any>(`SELECT EmpCode, EmpName FROM HR_EMPLOYEE WHERE NewICNo = ?`, [matchedEmp.nik]);
            console.log(`EmpCodes for NIK ${matchedEmp.nik}:`, empCodesFromNik);

            // 5. Test dataExtractorService for the TARGET gang
            console.log(`Step 5: Testing extractPayrollData for gang ${targetGang}...`);
            const result = await dataExtractorService.extractPayrollData(month, year, targetGang);
            const dataRows = result.data_rows;
            
            // Look for our specific employee in dataRows
            const targetEmpRow = dataRows.find(r => 
                (r.emp_code && empCodesFromNik.some((ec:any) => ec.EmpCode.trim() === r.emp_code.trim())) || 
                (r.nik && r.nik.trim() === matchedEmp.nik.trim())
            );

            if (targetEmpRow) {
                console.log("Target employee found in dataExtractor result:");
                console.log({
                    emp_code: targetEmpRow.emp_code,
                    nama: targetEmpRow.nama,
                    nik: targetEmpRow.nik,
                    pendapatan_thr: targetEmpRow.pendapatan_thr,
                    pendapatan_kontan: targetEmpRow.pendapatan_kontan,
                    pendapatan_kontanan: (targetEmpRow as any).pendapatan_kontanan,
                    all_fields: Object.keys(targetEmpRow).filter(k => k.startsWith('pendapatan_'))
                });
            } else {
                console.log(`Target employee NOT FOUND in dataRows for gang ${targetGang}`);
                console.log("First 3 employees in this gang:", dataRows.slice(0, 3).map(r => ({ code: r.emp_code, name: r.nama })));
            }

            const rowsWithKontan = dataRows.filter(r => r.pendapatan_kontan !== undefined || (r as any).pendapatan_kontanan !== undefined || (r as any).pendapatan_kontan > 0);
            console.log(`Total rows in gang ${targetGang}: ${dataRows.length}`);
            console.log(`Rows with any KONTAN field in this gang: ${rowsWithKontan.length}`);
        } else {
            console.log("Could not find any employee with KONTAN who is currently in a gang in HR_GANGLN.");
        }
    }
}

diagnose().catch(console.error).finally(() => process.exit());
