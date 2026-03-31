/**
 * Diagnostic script: Find which employees are missing THR and WHY
 * Checks: employee_other_incomes data vs gang members
 */
import { Database } from '../../src/services/database';

async function main() {
    const db = Database.getExtendedInstance();
    const mainDb = Database.getInstance();
    const gangCode = 'B2N';
    const month = 3, year = 2026;

    console.log(`\n=== DIAGNOSE THR MISSING for Gang ${gangCode}, ${month}/${year} ===\n`);

    // 1. Get all gang members (current HR_GANGLN)
    const gangMembers = await mainDb.query<any>(`
        SELECT RTRIM(gl.GangMember) as emp_code, 
               RTRIM(e.EmpName) as emp_name, 
               RTRIM(e.NewICNo) as nik,
               e.Religion
        FROM HR_GANGLN gl
        JOIN HR_EMPLOYEE e ON gl.GangMember = e.EmpCode
        WHERE RTRIM(gl.GangCode) = ?
        ORDER BY gl.GangMember
    `, [gangCode]);

    console.log(`Gang ${gangCode} has ${gangMembers.length} members:\n`);

    // 2. Get ALL THR records for this period
    const allThr = await db.query<any>(`
        SELECT id, nik, emp_code, emp_name, amount, income_type
        FROM employee_other_incomes
        WHERE period_year = ? AND period_month = ? AND income_type = 'THR'
    `, [year, month]);

    console.log(`Total THR records in DB for ${month}/${year}: ${allThr.length}\n`);

    // Build lookup maps
    const thrByEmpCode = new Map<string, any>();
    const thrByNik = new Map<string, any[]>();
    
    for (const thr of allThr) {
        const ec = (thr.emp_code || '').trim().toUpperCase();
        const nik = (thr.nik || '').trim().toUpperCase();
        
        if (ec) thrByEmpCode.set(ec, thr);
        if (nik) {
            if (!thrByNik.has(nik)) thrByNik.set(nik, []);
            thrByNik.get(nik)!.push(thr);
        }
    }

    // 3. Check each gang member
    let found = 0, missing = 0;
    const missingList: string[] = [];

    console.log('--- MEMBER CHECK ---');
    console.log('EmpCode      | NIK              | Name                          | THR by EmpCode | THR by NIK     | Status');
    console.log('-'.repeat(140));

    for (const m of gangMembers) {
        const ec = (m.emp_code || '').trim().toUpperCase();
        const nik = (m.nik || '').trim().toUpperCase();
        const name = (m.emp_name || '').trim();

        const thrByEc = thrByEmpCode.get(ec);
        const thrByNikArr = thrByNik.get(nik) || [];

        const ecAmount = thrByEc ? Number(thrByEc.amount).toLocaleString() : '-';
        const nikAmount = thrByNikArr.length > 0 
            ? thrByNikArr.map(t => `${Number(t.amount).toLocaleString()} (ec:${t.emp_code})`).join(', ')
            : '-';

        const hasAny = thrByEc || thrByNikArr.length > 0;
        const status = hasAny ? '✓ FOUND' : '❌ MISSING';

        if (!hasAny) {
            missing++;
            missingList.push(ec);
        } else {
            found++;
        }

        console.log(
            `${ec.padEnd(13)}| ${nik.padEnd(17)}| ${name.padEnd(30)}| ${ecAmount.padEnd(15)}| ${nikAmount.padEnd(15)}| ${status}`
        );
    }

    console.log('\n--- SUMMARY ---');
    console.log(`Found: ${found}, Missing: ${missing}`);

    // 4. For missing employees, check if they have ANY record by NIK in other division/gang
    if (missingList.length > 0) {
        console.log('\n--- DEEP CHECK: Missing employees ---');
        for (const ec of missingList) {
            // Get all possible em codes for this NIK
            const empInfo = await mainDb.query<any>(`
                SELECT RTRIM(e.EmpCode) as EmpCode, RTRIM(e.NewICNo) as NIK, RTRIM(e.EmpName) as EmpName, e.Religion, e.Status
                FROM HR_EMPLOYEE e
                WHERE RTRIM(e.NewICNo) = (SELECT RTRIM(NewICNo) FROM HR_EMPLOYEE WHERE RTRIM(EmpCode) = ?)
                   OR RTRIM(e.EmpCode) = ?
                ORDER BY e.CreateDate DESC
            `, [ec, ec]);

            console.log(`\n  ${ec}:`);
            for (const ei of empInfo) {
                const existsInThr = thrByEmpCode.has(ei.EmpCode.trim().toUpperCase());
                console.log(`    HR_EMPLOYEE: EmpCode=${ei.EmpCode}, NIK=${ei.NIK}, Name=${ei.EmpName}, Religion=${ei.Religion}, Status=${ei.Status}, THR exists=${existsInThr}`);
            }

            // Also check if there is a THR record stored with the NIK directly
            const nik = empInfo[0]?.NIK?.trim().toUpperCase();
            if (nik) {
                const nikThr = await db.query<any>(`
                    SELECT id, nik, emp_code, emp_name, amount, division_code, gang_code
                    FROM employee_other_incomes
                    WHERE period_year = ? AND period_month = ? AND income_type = 'THR'
                      AND (UPPER(RTRIM(nik)) = ? OR UPPER(RTRIM(emp_code)) = ?)
                `, [year, month, nik, ec]);
                
                if (nikThr.length > 0) {
                    for (const t of nikThr) {
                        console.log(`    THR RECORD: id=${t.id}, nik=${t.nik}, emp_code=${t.emp_code}, name=${t.emp_name}, amount=${t.amount}, div=${t.division_code}, gang=${t.gang_code}`);
                    }
                } else {
                    console.log(`    ❌ NO THR record found anywhere for NIK=${nik} or EmpCode=${ec}`);
                }
            }
        }
    }

    // 5. Also check: How many records exist that match B2N gang but different emp_codes
    console.log('\n\n--- CHECK: THR records matching B2N NIKs but with different emp_codes ---');
    const memberNiks = gangMembers.map((m: any) => (m.nik || '').trim()).filter(Boolean);
    if (memberNiks.length > 0) {
        const ph = memberNiks.map(() => '?').join(',');
        const nikMatchedThr = await db.query<any>(`
            SELECT nik, emp_code, emp_name, amount
            FROM employee_other_incomes
            WHERE period_year = ? AND period_month = ? AND income_type = 'THR'
              AND UPPER(RTRIM(nik)) IN (${ph})
        `, [year, month, ...memberNiks.map((n: string) => n.toUpperCase())]);

        console.log(`Found ${nikMatchedThr.length} THR records matching B2N member NIKs:`);
        for (const t of nikMatchedThr) {
            const memberEc = gangMembers.find((m: any) => (m.nik || '').trim().toUpperCase() === (t.nik || '').trim().toUpperCase())?.emp_code;
            const sameEc = memberEc?.trim().toUpperCase() === (t.emp_code || '').trim().toUpperCase();
            console.log(`  NIK=${t.nik}, THR emp_code=${t.emp_code}, Gang emp_code=${memberEc}, Same=${sameEc}, Amount=${t.amount}`);
        }
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
