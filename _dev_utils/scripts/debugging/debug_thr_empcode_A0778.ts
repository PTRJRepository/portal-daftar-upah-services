/**
 * Debug: Find THR data for empcode A0778 / NIK 1902052707850001
 */
import { Database } from '../db/client';

async function main() {
    const db = Database.getExtendedInstance();
    const mainDb = Database.getInstance();
    const venusDb = Database.getVenusInstance();

    const empCode = 'A0778';
    const nik = '1902052707850001';
    const month = 3;
    const year = 2026;

    console.log('='.repeat(80));
    console.log(`THR Debug for EmpCode: ${empCode}, NIK: ${nik}, Period: ${month}/${year}`);
    console.log('='.repeat(80));

    // Step 1: Check employee in VenusHR14
    console.log('\n[Step 1] Employee Master (VenusHR14)');
    const emp = await venusDb.query<any>(`
        SELECT EmpCode, EmpName, NewICNo, Religion, GangCode, DeptCode
        FROM HR_EMPLOYEE
        WHERE RTRIM(EmpCode) = ? OR RTRIM(NewICNo) = ?
    `, [empCode, nik]);
    if (emp.length > 0) {
        console.log(`  Found in HR_EMPLOYEE:`);
        emp.forEach((r: any) => {
            console.log(`    EmpCode=${r.EmpCode}, EmpName=${r.EmpName}, NewICNo=${r.NewICNo}, Religion=${r.Religion}, GangCode=${r.GangCode}`);
        });
    } else {
        console.log('  NOT found in HR_EMPLOYEE');
    }

    // Step 2: Check gang membership
    console.log('\n[Step 2] Gang Membership (HR_GANGLN)');
    const gangMembers = await mainDb.query<any>(`
        SELECT RTRIM(g.GangCode) as gang_code, RTRIM(g.GangMember) as emp_code, RTRIM(e.EmpName) as emp_name, RTRIM(e.NewICNo) as nik, e.Religion
        FROM HR_GANGLN g
        JOIN HR_EMPLOYEE e ON RTRIM(g.GangMember) = RTRIM(e.EmpCode)
        WHERE RTRIM(g.GangMember) = ?
    `, [empCode]);
    console.log(`  Found in ${gangMembers.length} gangs:`);
    gangMembers.forEach((r: any) => {
        console.log(`    Gang=${r.gang_code}, EmpCode=${r.emp_code}, Name=${r.emp_name}, NIK=${r.nik}, Religion=${r.Religion}`);
    });

    // Step 3: Check THR in employee_other_incomes
    console.log('\n[Step 3] THR in employee_other_incomes (extend_db_ptrj)');
    const thrRecords = await db.query<any>(`
        SELECT id, nik, emp_code, emp_name, amount, income_type, income_name, is_paid_in_thp, is_taxable,
               period_month, period_year, division_code, gang_code, details_json
        FROM employee_other_incomes
        WHERE (RTRIM(emp_code) = ? OR RTRIM(nik) = ?) AND income_type = 'THR'
        ORDER BY period_year DESC, period_month DESC
    `, [empCode, nik]);
    console.log(`  Found ${thrRecords.length} THR records:`);
    thrRecords.forEach((r: any) => {
        console.log(`    id=${r.id}, emp_code=${r.emp_code}, nik=${r.nik}, name=${r.emp_name}, period=${r.period_month}/${r.period_year}, amount=${r.amount}, income_name=${r.income_name}`);
        console.log(`      is_paid_in_thp=${r.is_paid_in_thp}, is_taxable=${r.is_taxable}, division=${r.division_code}, gang=${r.gang_code}`);
        if (r.details_json) {
            console.log(`      details_json: ${r.details_json}`);
        }
    });

    // Step 4: Check payroll history for this employee
    console.log('\n[Step 4] Payroll History (extend_db_ptrj)');
    const history = await db.query<any>(`
        SELECT TOP 10 nik, emp_name, emp_code, period_month, period_year, gang_code,
               pendapatan_thr, total_upah_kotor, upah_bersih
        FROM daftar_upah_history
        WHERE RTRIM(nik) = ? OR RTRIM(emp_code) = ?
        ORDER BY period_year DESC, period_month DESC
    `, [nik, empCode]);
    console.log(`  Found ${history.length} history records:`);
    history.forEach((r: any) => {
        console.log(`    Period=${r.period_month}/${r.period_year}, gang=${r.gang_code}, emp_code=${r.emp_code}, name=${r.emp_name}`);
        console.log(`      pendapatan_thr=${r.pendapatan_thr}, total_upah_kotor=${r.total_upah_kotor}, upah_bersih=${r.upah_bersih}`);
    });

    // Step 5: Check PR_ADTRANS for THR-like entries
    console.log('\n[Step 5] PR_ADTRANS THR entries (db_ptrj)');
    const adtrans = await mainDb.query<any>(`
        SELECT TOP 20 l.EmpCode, l.TrxDate, l.DocDesc, l.Amount, l.GangCode
        FROM PR_ADTRANS l
        WHERE RTRIM(l.EmpCode) = ? AND (l.DocDesc LIKE '%THR%' OR l.DocDesc LIKE '%thr%')
        ORDER BY l.TrxDate DESC
    `, [empCode]);
    console.log(`  Found ${adtrans.length} PR_ADTRANS entries:`);
    adtrans.forEach((r: any) => {
        console.log(`    EmpCode=${r.EmpCode}, Date=${r.TrxDate}, DocDesc=${r.DocDesc}, Amount=${r.Amount}, Gang=${r.GangCode}`);
    });

    // Step 6: Check HR_PAYROLL for this employee
    console.log('\n[Step 6] HR_PAYROLL for this employee');
    const payroll = await mainDb.query<any>(`
        SELECT RTRIM(p.EmpCode) as emp_code, RTRIM(p.PeriodMonth) as period_month, RTRIM(p.PeriodYear) as period_year,
               p.RiceRation, p.GangCode, p.JobTitle, p.DeptCode
        FROM HR_PAYROLL p
        WHERE RTRIM(p.EmpCode) = ?
        ORDER BY p.PeriodYear DESC, p.PeriodMonth DESC
    `, [empCode]);
    console.log(`  Found ${payroll.length} HR_PAYROLL records:`);
    payroll.slice(0, 6).forEach((r: any) => {
        console.log(`    EmpCode=${r.emp_code}, Period=${r.period_month}/${r.period_year}, RiceRation=${r.RiceRation}, Gang=${r.GangCode}`);
    });

    // Step 7: Check ALL income types for this employee this period
    console.log('\n[Step 7] ALL incomes for this employee in current period');
    const allIncomes = await db.query<any>(`
        SELECT id, nik, emp_code, emp_name, amount, income_type, income_name, is_paid_in_thp, is_taxable,
               period_month, period_year, division_code, gang_code
        FROM employee_other_incomes
        WHERE (RTRIM(emp_code) = ? OR RTRIM(nik) = ?) AND period_month = ? AND period_year = ?
        ORDER BY income_type, income_name
    `, [empCode, nik, month, year]);
    console.log(`  Found ${allIncomes.length} records:`);
    allIncomes.forEach((r: any) => {
        console.log(`    type=${r.income_type}, name=${r.income_name}, amount=${r.amount}, is_thp=${r.is_paid_in_thp}, is_tax=${r.is_taxable}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('END');
    console.log('='.repeat(80));
}

main().catch(e => { console.error(e); process.exit(1); });
