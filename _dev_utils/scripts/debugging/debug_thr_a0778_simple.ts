/**
 * Debug THR for A0778 / NIK 1902052707850001 - Simple version (no VenusHR14)
 * Run: cd backend && bun run src/scripts/debug_thr_a0778_simple.ts
 */
import { Database } from '../db/client';

async function main() {
    const db = Database.getInstance();       // db_ptrj (SERVER_PROFILE_1)
    const extDb = Database.getExtendedInstance(); // extend_db_ptrj (SERVER_PROFILE_1)

    const empCode = 'A0778';
    const nik = '1902052707850001';
    const month = 3;
    const year = 2026;

    console.log('='.repeat(80));
    console.log(`THR Debug - EmpCode: ${empCode}, NIK: ${nik}, Period: ${month}/${year}`);
    console.log('='.repeat(80));

    // Step 1: Find which gangs contain this emp_code
    console.log('\n[Step 1] Gang Membership (HR_GANGLN)');
    const gangs = await db.query<any>(`
        SELECT RTRIM(gl.GangCode) as gang_code, RTRIM(gl.GangMember) as emp_code,
               RTRIM(e.EmpName) as emp_name, RTRIM(e.NewICNo) as nik, e.Religion
        FROM HR_GANGLN gl
        JOIN HR_EMPLOYEE e ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        WHERE RTRIM(gl.GangMember) = ?
    `, [empCode]);
    console.log(`  Found in ${gangs.length} gang(s):`);
    gangs.forEach((r: any) => {
        console.log(`    Gang=${r.gang_code}, EmpCode=${r.emp_code}, Name=${r.emp_name}, NIK=${r.nik}, Religion=${r.Religion}`);
    });

    // Step 2: Find NIK from HR_EMPLOYEE
    console.log('\n[Step 2] HR_EMPLOYEE lookup');
    const empRows = await db.query<any>(`
        SELECT RTRIM(e.EmpCode) as emp_code, RTRIM(e.EmpName) as emp_name,
               RTRIM(e.NewICNo) as nik, e.Religion, e.Gender, e.Status
        FROM HR_EMPLOYEE e
        WHERE RTRIM(e.EmpCode) = ?
    `, [empCode]);
    if (empRows.length > 0) {
        console.log(`  EmpCode=${empRows[0].emp_code}, Name=${empRows[0].emp_name}, NIK=${empRows[0].nik}, Religion=${empRows[0].Religion}`);
    } else {
        console.log('  NOT found by EmpCode, trying NIK...');
        const byNik = await db.query<any>(`
            SELECT RTRIM(e.EmpCode) as emp_code, RTRIM(e.EmpName) as emp_name,
                   RTRIM(e.NewICNo) as nik, e.Religion
            FROM HR_EMPLOYEE e
            WHERE RTRIM(e.NewICNo) = ?
        `, [nik]);
        if (byNik.length > 0) {
            console.log(`  Found by NIK: EmpCode=${byNik[0].emp_code}, Name=${byNik[0].emp_name}, NIK=${byNik[0].nik}`);
        } else {
            console.log('  NOT found by NIK either!');
        }
    }

    // Step 3: Direct THR lookup in employee_other_incomes
    console.log('\n[Step 3] THR in employee_other_incomes (extend_db_ptrj) - ALL periods');
    const thrAll = await extDb.query<any>(`
        SELECT id, nik, emp_code, emp_name, amount, income_type, income_name, is_paid_in_thp, is_taxable,
               period_month, period_year, division_code, gang_code, details_json
        FROM employee_other_incomes
        WHERE (RTRIM(emp_code) = ? OR RTRIM(nik) = ?) AND income_type = 'THR'
        ORDER BY period_year DESC, period_month DESC
    `, [empCode, nik]);
    console.log(`  Found ${thrAll.length} THR records:`);
    thrAll.forEach((r: any) => {
        console.log(`    Period=${r.period_month}/${r.period_year}, emp_code="${r.emp_code}", nik="${r.nik}", name="${r.emp_name}", amount=${r.amount}`);
    });

    // Step 4: Check ALL other incomes for this period (no type filter)
    console.log('\n[Step 4] ALL incomes in extend_db_ptrj for this employee this period');
    const allIncomes = await extDb.query<any>(`
        SELECT id, nik, emp_code, emp_name, amount, income_type, income_name,
               period_month, period_year, is_paid_in_thp, is_taxable
        FROM employee_other_incomes
        WHERE (RTRIM(emp_code) = ? OR RTRIM(nik) = ?) AND period_month = ? AND period_year = ?
    `, [empCode, nik, month, year]);
    console.log(`  Found ${allIncomes.length} records:`);
    allIncomes.forEach((r: any) => {
        console.log(`    type=${r.income_type}, name="${r.income_name}", amount=${r.amount}, is_thp=${r.is_paid_in_thp}`);
    });

    // Step 5: If not found by emp_code or NIK, search by NAME
    if (thrAll.length === 0 && allIncomes.length === 0 && empRows.length > 0) {
        const empName = empRows[0].emp_name || '';
        console.log(`\n[Step 5] Searching by NAME: "${empName}"`);
        const byName = await extDb.query<any>(`
            SELECT id, nik, emp_code, emp_name, amount, income_type, income_name,
                   period_month, period_year, is_paid_in_thp
            FROM employee_other_incomes
            WHERE income_type = 'THR' AND period_year = ?
            AND UPPER(emp_name) LIKE ?
        `, [year, `%${empName.toUpperCase()}%`]);
        console.log(`  Found ${byName.length} records by name:`);
        byName.forEach((r: any) => {
            console.log(`    emp_code="${r.emp_code}", nik="${r.nik}", name="${r.emp_name}", period=${r.period_month}/${r.period_year}, amount=${r.amount}`);
        });
    }

    // Step 6: Count total THR records for this period to understand data size
    console.log('\n[Step 6] Total THR records in employee_other_incomes for this period');
    const totalThr = await extDb.query<any>(`
        SELECT COUNT(*) as total_count
        FROM employee_other_incomes
        WHERE income_type = 'THR' AND period_month = ? AND period_year = ?
    `, [month, year]);
    console.log(`  Total THR records for ${month}/${year}: ${totalThr[0].total_count}`);

    // Step 7: Show all NIKs that match our target NIK (case sensitivity check)
    console.log('\n[Step 7] NIK case sensitivity check');
    const nikExact = await extDb.query<any>(`
        SELECT nik, emp_code, emp_name, amount, income_type, period_month, period_year
        FROM employee_other_incomes
        WHERE nik LIKE '%1902052707850001%' OR nik LIKE '%1902052707850001%'
        ORDER BY period_year DESC, period_month DESC
    `, []);
    console.log(`  Found ${nikExact.length} records with partial NIK match:`);
    nikExact.slice(0, 10).forEach((r: any) => {
        console.log(`    nik="${r.nik}", emp_code="${r.emp_code}", name="${r.emp_name}", period=${r.period_month}/${r.period_year}, type=${r.income_type}, amount=${r.amount}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('END');
}

main().catch(e => { console.error(e); process.exit(1); });
