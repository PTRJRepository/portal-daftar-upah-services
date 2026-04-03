/**
 * Focused check - NIK matching in employee_other_incomes
 */
import { Database } from '../../src/db/client';
import { currentPeriodService } from '../../src/services/currentPeriodService';
import * as fs from 'fs';

const mainDb = Database.getInstance();
const extDb = Database.getExtendedInstance();

const lines: string[] = [];
function log(msg: string) {
    console.log(msg);
    lines.push(msg);
}

async function run() {
    const period = await currentPeriodService.getCurrentPeriod();
    const month = period.month;
    const year = period.year;

    log(`Period: ${month}/${year}`);

    // NIK fill stats
    const stats = await extDb.query<any>(`
        SELECT 
            income_type,
            COUNT(*) as total,
            SUM(CASE WHEN nik IS NOT NULL AND RTRIM(nik) <> '' THEN 1 ELSE 0 END) as has_nik,
            SUM(CASE WHEN emp_code IS NOT NULL AND RTRIM(emp_code) <> '' AND emp_code <> 'null' THEN 1 ELSE 0 END) as has_empcode,
            SUM(CASE WHEN emp_name IS NOT NULL AND emp_name <> '' THEN 1 ELSE 0 END) as has_empname
        FROM employee_other_incomes
        WHERE period_year = ? AND period_month = ?
        GROUP BY income_type
    `, [year, month]);

    log(`\nNIK/EmpCode fill stats for ${month}/${year}:`);
    for (const r of stats) {
        log(`  type=${r.income_type}: total=${r.total}, has_nik=${r.has_nik}, has_empcode=${r.has_empcode}, has_empname=${r.has_empname}`);
    }

    // Get sample KONTAN records
    log(`\n--- KONTAN sample records ---`);
    const kontanRecs = await extDb.query<any>(`
        SELECT TOP 10 id, nik, emp_code, emp_name, income_type, income_name, amount, 
               period_year, period_month, gang_code, division_code
        FROM employee_other_incomes
        WHERE (income_type = 'KONTAN' OR income_type = 'KONTANAN')
          AND period_year = ? AND period_month = ?
    `, [year, month]);
    if (kontanRecs.length === 0) {
        log('No KONTAN for current period - checking all periods:');
        const anyKontan = await extDb.query<any>(`
            SELECT TOP 10 id, nik, emp_code, emp_name, income_type, amount, period_year, period_month
            FROM employee_other_incomes
            WHERE income_type = 'KONTAN' OR income_type = 'KONTANAN'
            ORDER BY period_year DESC, period_month DESC
        `);
        for (const r of anyKontan) {
            log(`  ${r.period_month}/${r.period_year}: nik="${r.nik ?? 'NULL'}", code="${r.emp_code ?? 'NULL'}", name="${r.emp_name}", amount=${r.amount}`);
        }
    } else {
        for (const r of kontanRecs) {
            log(`  id=${r.id}, nik="${r.nik ?? 'NULL'}", code="${r.emp_code ?? 'NULL'}", name="${r.emp_name}", amount=${r.amount}, gang=${r.gang_code}`);
        }
    }

    // THR sample
    log(`\n--- THR sample records ---`);
    const thrRecs = await extDb.query<any>(`
        SELECT TOP 5 id, nik, emp_code, emp_name, income_type, amount, period_year, period_month
        FROM employee_other_incomes
        WHERE income_type = 'THR' AND period_year = ? AND period_month = ?
    `, [year, month]);
    for (const r of thrRecs) {
        log(`  nik="${r.nik ?? 'NULL'}", code="${r.emp_code ?? 'NULL'}", name="${r.emp_name}", amount=${r.amount}`);
    }

    // Get PG1A members and try to cross-check
    log(`\n--- PG1A members NIK cross-check with THR ---`);
    const pg1aMembers = await mainDb.query<any>(`
        SELECT TOP 5 RTRIM(gl.GangCode) as gang, RTRIM(gl.GangMember) as emp_code,
               RTRIM(e.EmpName) as emp_name, RTRIM(ISNULL(e.NewICNo,'')) as nik
        FROM HR_GANGLN gl
        JOIN HR_EMPLOYEE e ON RTRIM(e.EmpCode) = RTRIM(gl.GangMember)
        WHERE gl.GangCode LIKE 'P1A%'
    `);
    
    for (const m of pg1aMembers) {
        log(`  Member: EmpCode=${m.emp_code}, NIK="${m.nik}", Name="${m.emp_name}"`);
        
        if (m.nik) {
            // Check in THR
            const inThr = await extDb.query<any>(`
                SELECT id, nik, emp_code, emp_name, income_type, amount 
                FROM employee_other_incomes 
                WHERE nik = ? AND period_year = ? AND period_month = ?
            `, [m.nik, year, month]);
            log(`    → THR/OI records by NIK: ${inThr.length}`);
            for (const r of inThr) {
                log(`       type=${r.income_type}, amount=${r.amount}, stored_nik="${r.nik}"`);
            }

            // Try normalized (trim, uppercase) 
            const inThrNorm = await extDb.query<any>(`
                SELECT id, nik, emp_code, emp_name, income_type, amount 
                FROM employee_other_incomes 
                WHERE UPPER(RTRIM(nik)) = UPPER(RTRIM(?)) AND period_year = ? AND period_month = ?
            `, [m.nik, year, month]);
            if (inThrNorm.length !== inThr.length) {
                log(`    → With UPPER(RTRIM): ${inThrNorm.length} (different!)`);
            }
        }
    }

    // Save to file  
    fs.writeFileSync('_dev_utils/tests/oi_nik_result.txt', lines.join('\n'), 'utf8');
    log('\nOutput saved to _dev_utils/tests/oi_nik_result.txt');

    process.exit(0);
}

run().catch(e => { console.error('Error:', e); fs.writeFileSync('_dev_utils/tests/oi_nik_result.txt', `Error: ${e.message}\n${e.stack}`, 'utf8'); process.exit(1); });
