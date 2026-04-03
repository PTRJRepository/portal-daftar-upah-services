/**
 * Deep check: Find where THR is stored for "missing" employees
 * Search by NAME in employee_other_incomes to find mismatched NIK/empcode
 */
import { Database } from '../db/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

function cleanName(name: string): string {
    if (!name) return '';
    return name.replace(/\([^)]*\)/g, '').replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

async function main() {
    const db = Database.getExtendedInstance();
    const mainDb = Database.getInstance();
    const month = 3, year = 2026;
    const lines: string[] = [];
    const log = (msg: string) => lines.push(msg);

    log(`=== DEEP THR SEARCH BY NAME for missing employees ===`);

    // Get ALL THR records (no filter)
    const allThr = await db.query<any>(`
        SELECT id, nik, emp_code, emp_name, amount, division_code, gang_code
        FROM employee_other_incomes
        WHERE period_year = ${year} AND period_month = ${month} AND income_type = 'THR'
    `);
    log(`Total THR records: ${allThr.length}`);

    // Build maps
    const thrByNik = new Set(allThr.map((t: any) => (t.nik || '').trim().toUpperCase()));
    // Build name-based lookup
    const thrByCleanName = new Map<string, any[]>();
    for (const t of allThr) {
        const cn = cleanName(t.emp_name || '');
        if (cn) {
            if (!thrByCleanName.has(cn)) thrByCleanName.set(cn, []);
            thrByCleanName.get(cn)!.push(t);
        }
    }

    // Get all gang members
    const allMembers = await mainDb.query<any>(`
        SELECT RTRIM(gl.GangMember) as emp_code, RTRIM(e.EmpName) as emp_name,
               RTRIM(e.NewICNo) as nik, e.Religion, RTRIM(gl.GangCode) as gang
        FROM HR_GANGLN gl JOIN HR_EMPLOYEE e ON gl.GangMember = e.EmpCode
    `);

    // Find "missing" Muslim members
    let foundByName = 0, totalMissing = 0;
    const nikMismatchList: string[] = [];

    for (const m of allMembers) {
        const nik = (m.nik || '').trim().toUpperCase();
        const religion = (m.Religion || '').trim();
        const isMuslim = religion === '01' || religion.toUpperCase().includes('ISLAM');
        if (!isMuslim) continue;
        if (thrByNik.has(nik)) continue; // Already matched

        totalMissing++;
        const cn = cleanName(m.emp_name || '');
        const thrByNameArr = thrByCleanName.get(cn) || [];
        
        if (thrByNameArr.length > 0) {
            foundByName++;
            const thrInfo = thrByNameArr[0];
            const nikMatch = (thrInfo.nik || '').trim().toUpperCase() === nik;
            nikMismatchList.push(
                `${m.gang}|${m.emp_code}|member_nik=${nik}|thr_nik=${(thrInfo.nik||'').trim()}|` +
                `name=${cn.substring(0,30)}|amount=${thrInfo.amount}|` +
                `nik_match=${nikMatch}|thr_gang=${thrInfo.gang_code}`
            );
        } else {
            nikMismatchList.push(
                `${m.gang}|${m.emp_code}|nik=${nik}|name=${cn.substring(0,30)}|NO_THR_BY_NAME`
            );
        }
    }

    log(`\nMuslim missing (no NIK match): ${totalMissing}`);
    log(`Found by NAME instead: ${foundByName}`);
    log(`Still not found: ${totalMissing - foundByName}`);

    log(`\n=== DETAILS ===`);
    for (const l of nikMismatchList) {
        log(l);
    }

    // Stats: of those found by name, how many have NIK mismatch?
    const mismatchCount = nikMismatchList.filter(l => l.includes('nik_match=false')).length;
    const matchCount = nikMismatchList.filter(l => l.includes('nik_match=true')).length;
    log(`\n=== NIK MISMATCH STATS ===`);
    log(`NIK matches: ${matchCount} (shouldn't happen — these should have been caught)`);
    log(`NIK mismatches: ${mismatchCount} (THR exists but under different NIK!)`);
    log(`No THR at all: ${totalMissing - foundByName}`);

    // Show NIK mismatches
    log(`\n=== NIK MISMATCH EXAMPLES (THR exists but under DIFFERENT NIK) ===`);
    const mismatches = nikMismatchList.filter(l => l.includes('nik_match=false'));
    for (const l of mismatches.slice(0, 30)) {
        log(l);
    }

    const outPath = join(__dirname, '..', '..', 'diagnose_deep.txt');
    writeFileSync(outPath, lines.join('\n'), 'utf-8');
    console.log(`Written to ${outPath}`);
    console.log(`Missing=${totalMissing}, FoundByName=${foundByName}, NIK_Mismatch=${mismatchCount}`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
