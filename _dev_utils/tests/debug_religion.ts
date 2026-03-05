/**
 * Debug script: check what religion enrichment produces for THR data
 * Run: cd backend && bun run ../_dev_utils/tests/debug_religion.ts
 */
import { Database } from '../backend/src/services/database';

async function main() {
    const extDb = Database.getExtendedInstance();
    const mainDb = Database.getInstance();

    // 1) Get a sample of THR rows from employee_other_incomes (ARB1, G1H)
    const incomes = await extDb.query<any>(
        `SELECT TOP 10 nik, emp_name, division_code, gang_code, income_type 
         FROM employee_other_incomes 
         WHERE period_year = 2026 AND period_month = 2 AND division_code = 'ARB1' AND gang_code = 'G1H'`
    );

    console.log('\n=== Sample THR rows from employee_other_incomes ===');
    for (const row of incomes) {
        console.log(`  NIK: "${row.nik}" | Name: "${row.emp_name}" | Type: ${row.income_type}`);
    }

    // 2) For each nik, check what HR_EMPLOYEE returns
    console.log('\n=== HR_EMPLOYEE lookup results ===');
    for (const row of incomes.slice(0, 5)) {
        const nik = row.nik?.trim();
        if (!nik) continue;

        const hrResult = await mainDb.query<any>(
            `SELECT RTRIM(e.EmpCode) as EmpCode, RTRIM(e.NewICNo) as NewICNo, RTRIM(e.EmpName) as EmpName, e.Religion
             FROM HR_EMPLOYEE e
             WHERE RTRIM(e.EmpCode) = ? OR RTRIM(e.NewICNo) = ?`,
            [nik, nik]
        );

        if (hrResult.length > 0) {
            for (const hr of hrResult) {
                console.log(`  NIK="${nik}" => MATCH: EmpCode="${hr.EmpCode}" NewICNo="${hr.NewICNo}" Name="${hr.EmpName}" Religion="${hr.Religion}"`);
            }
        } else {
            // Try by name
            const nameResult = await mainDb.query<any>(
                `SELECT RTRIM(e.EmpCode) as EmpCode, RTRIM(e.NewICNo) as NewICNo, RTRIM(e.EmpName) as EmpName, e.Religion
                 FROM HR_EMPLOYEE e
                 WHERE RTRIM(e.EmpName) = ?`,
                [row.emp_name?.trim()]
            );
            if (nameResult.length > 0) {
                console.log(`  NIK="${nik}" => NO NIK MATCH, but NAME MATCH: EmpCode="${nameResult[0].EmpCode}" NewICNo="${nameResult[0].NewICNo}" Religion="${nameResult[0].Religion}"`);
            } else {
                console.log(`  NIK="${nik}" Name="${row.emp_name}" => NO MATCH AT ALL`);
            }
        }
    }

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
