/**
 * Check religion of missing THR employees
 */
import { Database } from '../db/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
    const db = Database.getExtendedInstance();
    const mainDb = Database.getInstance();
    const month = 3, year = 2026;

    const lines: string[] = [];
    const log = (msg: string) => lines.push(msg);

    // Get ALL THR NIKs
    const allThr = await db.query<any>(`
        SELECT DISTINCT UPPER(RTRIM(nik)) as nik FROM employee_other_incomes
        WHERE period_year = ${year} AND period_month = ${month} AND income_type = 'THR'
    `);
    const thrNikSet = new Set(allThr.map((t: any) => t.nik));

    // Get all gang members with religion
    const allMembers = await mainDb.query<any>(`
        SELECT RTRIM(gl.GangMember) as emp_code, RTRIM(e.NewICNo) as nik,
               RTRIM(e.EmpName) as name, e.Religion, RTRIM(gl.GangCode) as gang
        FROM HR_GANGLN gl
        JOIN HR_EMPLOYEE e ON gl.GangMember = e.EmpCode
    `);

    let muslimNoThr = 0, nonMuslimNoThr = 0, total = 0;
    const muslimMissing: string[] = [];

    for (const m of allMembers) {
        const nik = (m.nik || '').trim().toUpperCase();
        const hasThr = thrNikSet.has(nik);
        const religion = (m.Religion || '').trim();
        const isMuslim = religion === '01' || religion.toUpperCase().includes('ISLAM');

        if (!hasThr) {
            total++;
            if (isMuslim) {
                muslimNoThr++;
                muslimMissing.push(`${m.gang}|${m.emp_code}|${nik}|${m.name}|religion=${religion}`);
            } else {
                nonMuslimNoThr++;
            }
        }
    }

    log(`=== MISSING THR BREAKDOWN ===`);
    log(`Total missing: ${total}`);
    log(`Muslim (should have THR): ${muslimNoThr}`);
    log(`Non-Muslim (expected no THR): ${nonMuslimNoThr}`);
    log(`\n=== MUSLIM EMPLOYEES MISSING THR ===`);
    for (const m of muslimMissing) {
        log(m);
    }

    const outPath = join(__dirname, '..', '..', 'diagnose_religion.txt');
    writeFileSync(outPath, lines.join('\n'), 'utf-8');
    console.log(`EmpCode keys: EC=0, NIK=${thrNikSet.size}`);
    console.log(`Missing: Muslim=${muslimNoThr}, NonMuslim=${nonMuslimNoThr}, Total=${total}`);
    console.log(`Written to ${outPath}`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
