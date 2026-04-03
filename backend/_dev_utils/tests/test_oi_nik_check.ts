/**
 * Check exact data in employee_other_incomes - what columns are filled
 */
import { Database } from '../../src/db/client';
import { currentPeriodService } from '../../src/services/currentPeriodService';

const mainDb = Database.getInstance();
const extDb = Database.getExtendedInstance();

async function run() {
    const period = await currentPeriodService.getCurrentPeriod();
    const month = period.month;
    const year = period.year;

    console.log(`Period: ${month}/${year}`);

    // What columns does the table have?
    const columns = await extDb.query<any>(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'employee_other_incomes'
        ORDER BY ORDINAL_POSITION
    `);
    console.log(`\nTable columns:`);
    for (const c of columns) {
        console.log(`  ${c.COLUMN_NAME} (${c.DATA_TYPE}, nullable=${c.IS_NULLABLE})`);
    }

    // Sample raw records
    const rawRows = await extDb.query<any>(`
        SELECT TOP 10 id, nik, emp_code, emp_name, income_type, income_name, amount, 
               is_paid_in_thp, is_taxable, period_year, period_month,
               division_code, gang_code
        FROM employee_other_incomes
        WHERE period_year = ? AND period_month = ?
        ORDER BY income_type
    `, [year, month]);

    console.log(`\nSample records for ${month}/${year}:`);
    for (const r of rawRows) {
        console.log(`  id=${r.id}, nik="${r.nik ?? 'NULL'}", emp_code="${r.emp_code ?? 'NULL'}", emp_name="${r.emp_name}", type=${r.income_type}, amount=${r.amount}`);
    }

    // Count by NIK filled vs empty
    const stats = await extDb.query<any>(`
        SELECT 
            income_type,
            COUNT(*) as total,
            SUM(CASE WHEN nik IS NOT NULL AND nik <> '' THEN 1 ELSE 0 END) as has_nik,
            SUM(CASE WHEN emp_code IS NOT NULL AND emp_code <> '' THEN 1 ELSE 0 END) as has_empcode,
            SUM(CASE WHEN emp_name IS NOT NULL AND emp_name <> '' THEN 1 ELSE 0 END) as has_empname
        FROM employee_other_incomes
        WHERE period_year = ? AND period_month = ?
        GROUP BY income_type
    `, [year, month]);

    console.log(`\nNIK/EmpCode fill stats for ${month}/${year}:`);
    for (const r of stats) {
        console.log(`  type=${r.income_type}: total=${r.total}, has_nik=${r.has_nik}, has_empcode=${r.has_empcode}, has_empname=${r.has_empname}`);
    }

    // If no records for current month, check last 3 months
    if (rawRows.length === 0) {
        const recent = await extDb.query<any>(`
            SELECT TOP 5 id, nik, emp_code, emp_name, income_type, amount, period_year, period_month
            FROM employee_other_incomes
            ORDER BY period_year DESC, period_month DESC
        `);
        console.log(`\nMost recent records in employee_other_incomes:`);
        for (const r of recent) {
            console.log(`  ${r.period_month}/${r.period_year}: nik="${r.nik ?? 'NULL'}", code="${r.emp_code ?? 'NULL'}", name="${r.emp_name}", type=${r.income_type}, amount=${r.amount}`);
        }
    }

    // Check for KONTAN specifically
    console.log(`\n--- KONTAN records ---`);
    const kontanRows = await extDb.query<any>(`
        SELECT TOP 20 nik, emp_code, emp_name, income_type, income_name, amount, period_year, period_month
        FROM employee_other_incomes
        WHERE income_type = 'KONTAN' OR income_type = 'KONTANAN'
        ORDER BY period_year DESC, period_month DESC
    `);
    if (kontanRows.length === 0) {
        console.log('No KONTAN records found in any period!');
    } else {
        console.log(`KONTAN records (${kontanRows.length}):`);
        for (const r of kontanRows) {
            console.log(`  ${r.period_month}/${r.period_year}: nik="${r.nik ?? 'NULL'}", code="${r.emp_code ?? 'NULL'}", name="${r.emp_name}", amount=${r.amount}`);
        }
    }

    // Check sample NIKs in HR_EMPLOYEE for gang PG1A members
    console.log(`\n--- Sample PG1A members NIK from HR_GANGLN ---`);
    const pg1aMembers = await mainDb.query<any>(`
        SELECT TOP 10 RTRIM(gl.GangCode) as gang, RTRIM(gl.GangMember) as emp_code,
               RTRIM(e.EmpName) as emp_name, RTRIM(e.NewICNo) as nik
        FROM HR_GANGLN gl
        JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(gl.GangMember)
        WHERE gl.GangCode LIKE 'P1A%'
    `);
    for (const m of pg1aMembers) {
        console.log(`  Gang=${m.gang}, EmpCode=${m.emp_code}, NIK="${m.nik ?? 'NULL'}", Name="${m.emp_name}"`);
    }

    // Cross-check: find a NIK from HR_EMPLOYEE and check if it's in employee_other_incomes
    if (pg1aMembers.length > 0) {
        const sampleNik = pg1aMembers.find((m: any) => m.nik)?.nik;
        if (sampleNik) {
            console.log(`\n--- X-check: does NIK ${sampleNik} exist in employee_other_incomes? ---`);
            const xcheck = await extDb.query<any>(`
                SELECT id, nik, emp_code, emp_name, income_type, amount, period_year, period_month
                FROM employee_other_incomes
                WHERE nik = ?
            `, [sampleNik]);
            if (xcheck.length === 0) {
                console.log(`NOT FOUND in employee_other_incomes`);
                // Try with RTRIM  
                const xcheck2 = await extDb.query<any>(`
                    SELECT id, nik, emp_code, emp_name, income_type, amount, period_year, period_month
                    FROM employee_other_incomes
                    WHERE RTRIM(nik) = RTRIM(?)
                `, [sampleNik]);
                if (xcheck2.length > 0) {
                    console.log(`Found with RTRIM comparison! (trailing spaces issue)`);
                } else {
                    console.log(`Also not found with RTRIM comparison`);
                }
            } else {
                console.log(`FOUND: ${xcheck.length} records`);
            }
        }
    }

    console.log(`\n=== DONE ===`);
    process.exit(0);
}

run().catch(e => { console.error('Error:', e); process.exit(1); });
