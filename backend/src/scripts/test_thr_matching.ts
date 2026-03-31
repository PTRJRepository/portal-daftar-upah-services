import { Database } from "../db/client";

const dbExt = Database.getExtendedInstance(); // extend_db_ptrj — for employee_other_incomes
const db = Database.getInstance();           // db_ptrj — for HR_EMPLOYEE, HR_GANGLN

function cleanNameFormat(name: string): string {
    if (!name) return '';
    return name.replace(/\([^)]*\)/g, '').replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

async function runTest() {
    console.log("=== Testing THR Mapping (EMP_CODE → NIK → NIK+NAME) ===");

    const month = 3;
    const year = 2026;

    // Step 1: Fetch THR from employee_other_incomes
    const dbOtherIncomes = await dbExt.query(`
        SELECT nik, emp_code, emp_name, amount, income_type, is_paid_in_thp, is_taxable
        FROM employee_other_incomes
        WHERE period_year = ? AND period_month = ? AND income_type = 'THR'
    `, [year, month]);

    console.log(`Found ${dbOtherIncomes.length} THR records for ${month}/${year}`);

    if (dbOtherIncomes.length === 0) {
        console.log("No THR data found. Exiting.");
        return;
    }

    // Debug: check emp_code population
    const empCodeSample = dbOtherIncomes.slice(0, 5).map((r: any) => ({
        nik: r.nik, emp_code: r.emp_code, emp_name: r.emp_name
    }));
    console.log(`THR sample (nik, emp_code, emp_name):`, JSON.stringify(empCodeSample, null, 2));

    // Build maps using new priority: EMP_CODE → NIK → NIK+NAME
    const thrByEmpCode = new Map<string, any>();
    const thrByNik = new Map<string, any>();
    const thrByNikName = new Map<string, any>();

    // Count NIK duplicates first
    const nikCount = new Map<string, number>();
    for (const inc of dbOtherIncomes) {
        const nik = String(inc.nik || '').trim().toUpperCase();
        if (nik) nikCount.set(nik, (nikCount.get(nik) || 0) + 1);
    }

    for (const inc of dbOtherIncomes) {
        const nik = String(inc.nik || '').trim().toUpperCase();
        const empCode = String(inc.emp_code || '').trim().toUpperCase();
        const dbEmpName = String(inc.emp_name || '').trim().toUpperCase();
        const cleanName = cleanNameFormat(dbEmpName);
        const nikNameKey = nik ? `${nik}||${cleanName}` : '';

        // Level 1: by emp_code
        if (empCode) thrByEmpCode.set(empCode, inc);

        // Level 2: by NIK
        if (nik) thrByNik.set(nik, inc);

        // Level 3: by NIK+NAME for duplicates
        if (nik && nikCount.get(nik)! > 1 && nikNameKey) {
            thrByNikName.set(nikNameKey, inc);
        }
    }

    console.log(`Map sizes — byEmpCode: ${thrByEmpCode.size}, byNik: ${thrByNik.size}, byNikName: ${thrByNikName.size}`);

    // Step 2: Get active Muslim employees from db_ptrj
    // Religion '01' = Islam in HR_EMPLOYEE.Religion
    const employeesData = await db.query(`
        SELECT DISTINCT TOP 1000
            e.EmpCode,
            e.NewICNo as ActualNIK,
            e.EmpName,
            e.Religion,
            gl.GangCode
        FROM HR_EMPLOYEE e
        INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        INNER JOIN HR_GANG g ON RTRIM(g.GangCode) = RTRIM(gl.GangCode)
        WHERE RTRIM(e.Religion) = '01'
    `);

    console.log(`Found ${employeesData.length} active Muslim employees in db_ptrj`);

    let level1Matched = 0;  // by emp_code
    let level2Matched = 0;  // by NIK
    let level3Matched = 0;  // by NIK+NAME
    let unmatched = 0;

    for (const emp of employeesData) {
        const empCode = String(emp.EmpCode || '').trim().toUpperCase();
        const nik = String(emp.ActualNIK || '').trim().toUpperCase();
        const empName = String(emp.EmpName || '').trim().toUpperCase();
        const gang = emp.GangCode || 'UNKNOWN';

        let matched = false;

        // Level 1: emp_code
        if (empCode && thrByEmpCode.has(empCode)) {
            matched = true;
            level1Matched++;
        }
        // Level 2: NIK
        else if (nik && thrByNik.has(nik)) {
            matched = true;
            level2Matched++;
        }
        // Level 3: NIK + NAME (duplicate NIK)
        else if (nik) {
            const cleanName = cleanNameFormat(empName);
            const nikNameKey = `${nik}||${cleanName}`;
            if (thrByNikName.has(nikNameKey)) {
                matched = true;
                level3Matched++;
            }
        }

        if (!matched) {
            unmatched++;
            console.log(`UNMATCHED: gang=${gang}, empCode=${empCode}, NIK=${nik}, Name=${empName}`);
        }
    }

    console.log("\n=== SUMMARY ===");
    console.log(`Total Muslim Employees: ${employeesData.length}`);
    console.log(`Matched by EMP_CODE: ${level1Matched}`);
    console.log(`Matched by NIK (fallback): ${level2Matched}`);
    console.log(`Matched by NIK+NAME (duplicate): ${level3Matched}`);
    console.log(`Unmatched: ${unmatched}`);
    console.log(`Total Matched: ${level1Matched + level2Matched + level3Matched}`);
}

runTest().catch(console.error).finally(() => process.exit());
