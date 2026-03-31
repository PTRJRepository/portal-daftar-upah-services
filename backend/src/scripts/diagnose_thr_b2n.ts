import { Database } from '../db/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
    const db = Database.getExtendedInstance();
    const mainDb = Database.getInstance();
    const gangCode = 'B2N';
    const month = 3, year = 2026;

    const lines: string[] = [];
    const log = (msg: string) => { lines.push(msg); console.log(msg); };

    log(`=== DIAGNOSE THR for ${gangCode} ${month}/${year} ===`);

    // Get gang members
    const gangMembers = await mainDb.query<any>(`
        SELECT RTRIM(gl.GangMember) as emp_code, RTRIM(e.EmpName) as emp_name, 
               RTRIM(e.NewICNo) as nik, e.Religion
        FROM HR_GANGLN gl JOIN HR_EMPLOYEE e ON gl.GangMember = e.EmpCode
        WHERE RTRIM(gl.GangCode) = ?
        ORDER BY gl.GangMember
    `, [gangCode]);

    log(`Gang members: ${gangMembers.length}`);

    // Get ALL THR (no filter)
    const allThr = await db.query<any>(`
        SELECT nik, emp_code, emp_name, amount FROM employee_other_incomes
        WHERE period_year = ${year} AND period_month = ${month} AND income_type = 'THR'
    `);
    
    log(`Total THR records: ${allThr.length}`);

    // Build maps
    const thrByEc = new Map<string, number>();
    const thrByNik = new Map<string, { amount: number; emp_code: string }>();
    for (const t of allThr) {
        const ec = (t.emp_code || '').trim().toUpperCase();
        const nik = (t.nik || '').trim().toUpperCase();
        if (ec) thrByEc.set(ec, Number(t.amount));
        if (nik) thrByNik.set(nik, { amount: Number(t.amount), emp_code: ec });
    }

    log(`\nEmpCode | NIK | Name | THR_by_EC | THR_by_NIK | Status`);
    
    let found = 0, missing = 0, nikOnly = 0;
    const missingEmps: string[] = [];

    for (const m of gangMembers) {
        const ec = (m.emp_code || '').trim().toUpperCase();
        const nik = (m.nik || '').trim().toUpperCase();
        const name = (m.emp_name || '').trim();
        
        const byEc = thrByEc.get(ec);
        const byNik = thrByNik.get(nik);
        
        let status = '';
        if (byEc !== undefined) { status = 'OK_EC'; found++; }
        else if (byNik) { 
            status = `NIK_ONLY(stored_ec:${byNik.emp_code})`; 
            nikOnly++; found++; 
        }
        else { status = 'MISSING'; missing++; missingEmps.push(ec); }

        log(`${ec} | ${nik} | ${name.substring(0,25)} | ${byEc ?? '-'} | ${byNik ? byNik.amount : '-'} | ${status}`);
    }

    log(`\nSUMMARY: Found=${found} (EC=${found-nikOnly}, NIK_ONLY=${nikOnly}), Missing=${missing}`);

    if (missingEmps.length > 0) {
        log(`\nMISSING employees: ${missingEmps.join(', ')}`);
        for (const ec of missingEmps) {
            const nik = gangMembers.find((m:any) => m.emp_code.trim().toUpperCase() === ec)?.nik?.trim() || '';
            // Check all emp_codes for this NIK
            const allEc = await mainDb.query<any>(`
                SELECT RTRIM(EmpCode) as ec FROM HR_EMPLOYEE WHERE RTRIM(NewICNo) = '${nik}'
            `);
            const allEcList = allEc.map((r:any) => r.ec);
            log(`  ${ec} (NIK=${nik}): All emp_codes: ${allEcList.join(',') || 'NONE'}`);
            
            // Check if THR exists for any of those
            for (const altEc of allEcList) {
                const hasThr = thrByEc.has(altEc.trim().toUpperCase());
                log(`    emp_code=${altEc}: has THR = ${hasThr}`);
            }
        }
    }

    // Write output
    const outPath = join(__dirname, '..', '..', 'diagnose_thr.txt');
    writeFileSync(outPath, lines.join('\n'), 'utf-8');
    log(`\nOutput written to: ${outPath}`);
    
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
