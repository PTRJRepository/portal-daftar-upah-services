/**
 * Trace EXACT API flow for THR matching
 * Simulates what dataExtractorService does
 */
import { Database } from '../db/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

function cleanNameFormat(name: string): string {
    if (!name) return '';
    return name.replace(/\([^)]*\)/g, '').replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

async function main() {
    const db = Database.getExtendedInstance();
    const mainDb = Database.getInstance();
    const month = 3, year = 2026;
    const gangCode = 'E2H'; // Gang with most missing (23 missing)
    
    const lines: string[] = [];
    const log = (msg: string) => lines.push(msg);

    log(`=== TRACE THR FLOW for ${gangCode}, ${month}/${year} ===\n`);

    // STEP 1: Simulate getRawIncomes - now fetches ALL (no gang filter)
    const allIncomes = await db.query<any>(`
        SELECT id, nik, emp_code, emp_name, amount, income_type, is_paid_in_thp, is_taxable,
               division_code, gang_code
        FROM employee_other_incomes
        WHERE period_year = ${year} AND period_month = ${month}
    `);
    const thrIncomes = allIncomes.filter((r: any) => r.income_type === 'THR');
    log(`Step 1: getRawIncomes fetched ${allIncomes.length} total, ${thrIncomes.length} THR`);

    // STEP 2: Build maps (same as dataExtractorService)
    const thrByEmpCode = new Map<string, any>();
    const thrByNik = new Map<string, any>();
    const thrByCleanName = new Map<string, any>();
    
    for (const inc of thrIncomes) {
        const ec = (inc.emp_code || '').trim().toUpperCase();
        const nik = (inc.nik || '').trim().toUpperCase();
        const cn = cleanNameFormat(inc.emp_name || '');
        
        if (ec) thrByEmpCode.set(ec, inc);
        if (nik) thrByNik.set(nik, inc);
        if (cn) thrByCleanName.set(cn, inc);
    }
    log(`Step 2: Maps - byEc: ${thrByEmpCode.size}, byNik: ${thrByNik.size}, byCleanName: ${thrByCleanName.size}`);

    // STEP 3: Get gang members (like dataExtractorService gets from HR_PAYROLL/history)
    const members = await mainDb.query<any>(`
        SELECT RTRIM(gl.GangMember) as emp_code, RTRIM(e.EmpName) as emp_name,
               RTRIM(e.NewICNo) as nik, e.Religion
        FROM HR_GANGLN gl
        JOIN HR_EMPLOYEE e ON gl.GangMember = e.EmpCode
        WHERE RTRIM(gl.GangCode) = ?
        ORDER BY gl.GangMember
    `, [gangCode]);
    log(`Step 3: ${members.length} gang members in ${gangCode}\n`);

    // STEP 4: Try matching each member
    let byEc = 0, byNik = 0, byName = 0, missing = 0;
    
    log(`EmpCode | NIK | Name | Religion | Level | THR Amount | THR Source`);
    log('-'.repeat(130));

    for (const m of members) {
        const ec = (m.emp_code || '').trim().toUpperCase();
        const nik = (m.nik || '').trim().toUpperCase();
        const name = (m.emp_name || '').trim();
        const cn = cleanNameFormat(name);
        const religion = (m.Religion || '').trim();
        const isMuslim = religion === '01';

        let level = 'MISS';
        let amount = 0;
        let source = '';

        // Level 1: emp_code
        if (ec && thrByEmpCode.has(ec)) {
            level = 'L1:EC';
            const t = thrByEmpCode.get(ec);
            amount = Number(t.amount);
            source = `ec=${t.emp_code},nik=${t.nik}`;
            byEc++;
        }
        // Level 2: NIK
        else if (nik && thrByNik.has(nik)) {
            level = 'L2:NIK';
            const t = thrByNik.get(nik);
            amount = Number(t.amount);
            source = `ec=${t.emp_code},nik=${t.nik}`;
            byNik++;
        }
        // Level 4: Cleaned Name
        else if (cn && thrByCleanName.has(cn)) {
            level = 'L4:NAME';
            const t = thrByCleanName.get(cn);
            amount = Number(t.amount);
            source = `ec=${t.emp_code},nik=${t.nik},name=${(t.emp_name||'').trim().substring(0,25)}`;
            byName++;
        }
        else {
            level = isMuslim ? '❌MISS(MUSLIM)' : 'MISS(non-muslim)';
            missing++;
        }

        log(`${ec.padEnd(8)} | ${nik.padEnd(20)} | ${cn.substring(0,25).padEnd(25)} | ${(isMuslim?'Muslim':'Other').padEnd(8)} | ${level.padEnd(16)} | ${amount ? amount.toLocaleString() : '-'} | ${source}`);
    }

    log(`\nSUMMARY for ${gangCode}:`);
    log(`L1(EmpCode): ${byEc}, L2(NIK): ${byNik}, L4(Name): ${byName}, Missing: ${missing}`);

    // STEP 5: Show common name collisions
    log(`\n=== POTENTIAL NAME COLLISION CHECK ===`);
    const nameCount = new Map<string, number>();
    for (const inc of thrIncomes) {
        const cn = cleanNameFormat(inc.emp_name || '');
        if (cn) nameCount.set(cn, (nameCount.get(cn) || 0) + 1);
    }
    const duplicateNames = [...nameCount.entries()].filter(([, count]) => count > 1);
    log(`Names appearing >1 time in THR data: ${duplicateNames.length}`);
    for (const [name, count] of duplicateNames.sort((a, b) => b[1] - a[1]).slice(0, 20)) {
        log(`  "${name}" appears ${count} times`);
    }

    // STEP 6: For missing Muslim employees, search by partial name
    const missingMuslim = members.filter((m: any) => {
        const ec = (m.emp_code || '').trim().toUpperCase();
        const nik = (m.nik || '').trim().toUpperCase();
        const cn = cleanNameFormat(m.emp_name || '');
        const religion = (m.Religion || '').trim();
        return religion === '01' && !thrByEmpCode.has(ec) && !thrByNik.has(nik) && !thrByCleanName.has(cn);
    });
    
    if (missingMuslim.length > 0) {
        log(`\n=== MISSING MUSLIM EMPLOYEES - DEEP SEARCH ===`);
        for (const m of missingMuslim) {
            const cn = cleanNameFormat(m.emp_name || '');
            const firstName = cn.split(' ')[0];
            
            // Search by first name
            const candidates = thrIncomes.filter((t: any) => {
                const tcn = cleanNameFormat(t.emp_name || '');
                return tcn.startsWith(firstName + ' ') || tcn === firstName;
            });

            log(`\n  ${m.emp_code} | ${(m.nik||'').trim()} | ${cn}:`);
            if (candidates.length > 0) {
                log(`    Candidates by first name "${firstName}":`);
                for (const c of candidates) {
                    log(`      nik=${(c.nik||'').trim()}, name=${cleanNameFormat(c.emp_name)}, amount=${c.amount}, gang=${c.gang_code}`);
                }
            } else {
                log(`    No candidates found even by first name "${firstName}"`);
            }
        }
    }

    const outPath = join(__dirname, '..', '..', 'trace_thr_flow.md');
    writeFileSync(outPath, lines.join('\n'), 'utf-8');
    console.log(`Written to ${outPath}`);
    console.log(`L1=${byEc}, L2=${byNik}, L4=${byName}, Miss=${missing}`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
