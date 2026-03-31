/**
 * Check if missing employees' THR exists in OTHER periods or ANY table
 */
import { Database } from '../db/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
    const db = Database.getExtendedInstance();
    const mainDb = Database.getInstance();
    const lines: string[] = [];
    const log = (msg: string) => lines.push(msg);

    // Missing Muslim employees from E2H (by NIK)
    const missingNiks = [
        '5203143012720009', // SAHAN
        '1902040712990001', // BIRANDA  
        '5203013112850295', // HANAPI
        '5203010107890404', // MUH SAUN
        '1906042702990003', // TRIO BAKTI
        '5203073003800003', // MASRUN
        '5203071210810002', // NASRI
        '5203083112950096', // SARIPUDIN
        '',                  // KAMALUDDIN (no NIK)
        '5203021607010001', // HAIRURROZI
        '5203200806000003', // IRWAN HADI
        '520307050507940001', // ERWIN NURJAYADI
        '5202113112770009', // MUSAHDAT
        '5203200406990002', // SAATULLAH
        '5203200905910001', // ISATARUDIN
    ];
    const missingEmpCodes = ['E0031','E0155','E0363','E0364','E0403','E0460','E0461','E0468','E0470','E0477','E0479','E0558','E0568','E0576','E0577'];

    log(`=== CHECK: Where is THR for missing E2H employees? ===`);

    // 1. Check ALL periods in employee_other_incomes
    log(`\n--- Check in employee_other_incomes (ALL periods) ---`);
    for (let i = 0; i < missingNiks.length; i++) {
        const nik = missingNiks[i];
        const ec = missingEmpCodes[i];
        
        let rows: any[] = [];
        if (nik) {
            rows = await db.query<any>(`
                SELECT period_year, period_month, income_type, amount, nik, emp_code, emp_name
                FROM employee_other_incomes
                WHERE UPPER(RTRIM(nik)) = ? OR UPPER(RTRIM(emp_code)) = ?
            `, [nik.toUpperCase(), ec.toUpperCase()]);
        } else {
            rows = await db.query<any>(`
                SELECT period_year, period_month, income_type, amount, nik, emp_code, emp_name
                FROM employee_other_incomes
                WHERE UPPER(RTRIM(emp_code)) = ?
            `, [ec.toUpperCase()]);
        }

        if (rows.length > 0) {
            log(`  ${ec} (NIK=${nik}): FOUND ${rows.length} records!`);
            for (const r of rows) {
                log(`    period=${r.period_month}/${r.period_year}, type=${r.income_type}, amount=${r.amount}, nik=${r.nik}, ec=${r.emp_code}`);
            }
        } else {
            log(`  ${ec} (NIK=${nik}): ❌ NOT FOUND in any period`);
        }
    }

    // 2. Also check: do these employees have OLD emp_codes with THR?
    log(`\n--- Check via ALL HR_EMPLOYEE records (old emp_codes) ---`);
    for (let i = 0; i < missingNiks.length; i++) {
        const nik = missingNiks[i];
        const ec = missingEmpCodes[i];
        if (!nik) {
            log(`  ${ec}: Skipping (no NIK)`);
            continue;
        }

        // Find ALL emp_codes for this person
        const allRecords = await mainDb.query<any>(`
            SELECT RTRIM(EmpCode) as EmpCode, RTRIM(NewICNo) as NIK, RTRIM(EmpName) as Name, Religion, Status
            FROM HR_EMPLOYEE
            WHERE RTRIM(NewICNo) = ? OR RTRIM(EmpCode) = ?
        `, [nik, ec]);

        if (allRecords.length > 1) {
            log(`  ${ec} has ${allRecords.length} HR_EMPLOYEE records:`);
            for (const r of allRecords) {
                // Check if THR exists for this emp_code
                const thr = await db.query<any>(`
                    SELECT amount, nik, emp_code, period_year, period_month
                    FROM employee_other_incomes
                    WHERE (UPPER(RTRIM(emp_code)) = ? OR UPPER(RTRIM(nik)) = ?) AND income_type = 'THR'
                `, [r.EmpCode.trim().toUpperCase(), (r.NIK || '').trim().toUpperCase()]);
                log(`    EmpCode=${r.EmpCode}, NIK=${r.NIK}, Name=${r.Name}, Status=${r.Status}, THR records=${thr.length}`);
                for (const t of thr) {
                    log(`      → THR: amount=${t.amount}, period=${t.period_month}/${t.period_year}`);
                }
            }
        }
    }

    // 3. Check total counts per period
    log(`\n--- THR record counts by period ---`);
    const periods = await db.query<any>(`
        SELECT period_year, period_month, COUNT(*) as cnt
        FROM employee_other_incomes
        WHERE income_type = 'THR'
        GROUP BY period_year, period_month
        ORDER BY period_year, period_month
    `);
    for (const p of periods) {
        log(`  ${p.period_month}/${p.period_year}: ${p.cnt} records`);
    }

    const outPath = join(__dirname, '..', '..', 'trace_missing_thr.md');
    writeFileSync(outPath, lines.join('\n'), 'utf-8');
    console.log(`Written to ${outPath}`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
