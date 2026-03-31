/**
 * Diagnostic: Check ALL gangs for THR match rate
 * Identifies which gangs have worst THR matching
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

    log(`=== THR MATCH RATE FOR ALL GANGS ${month}/${year} ===`);

    // Get ALL THR records
    const allThr = await db.query<any>(`
        SELECT nik, emp_code, amount FROM employee_other_incomes
        WHERE period_year = ${year} AND period_month = ${month} AND income_type = 'THR'
    `);
    log(`Total THR records: ${allThr.length}`);

    // Build lookup maps
    const thrByEc = new Map<string, number>();
    const thrByNik = new Map<string, number>();
    for (const t of allThr) {
        const ec = (t.emp_code || '').trim().toUpperCase();
        const nik = (t.nik || '').trim().toUpperCase();
        if (ec) thrByEc.set(ec, Number(t.amount));
        if (nik) thrByNik.set(nik, Number(t.amount));
    }
    log(`THR by EmpCode keys: ${thrByEc.size}, by NIK keys: ${thrByNik.size}`);

    // Get all gangs
    const gangs = await mainDb.query<any>(`
        SELECT DISTINCT RTRIM(GangCode) as gang_code FROM HR_GANG ORDER BY gang_code
    `);

    log(`\nGang | Members | EC_Match | NIK_Match | Missing | Match%`);
    log('-'.repeat(80));

    let totalMembers = 0, totalEcMatch = 0, totalNikMatch = 0, totalMissing = 0;
    const worstGangs: { gang: string, missing: number, members: number }[] = [];

    for (const g of gangs) {
        const gc = g.gang_code;
        
        const members = await mainDb.query<any>(`
            SELECT RTRIM(gl.GangMember) as emp_code, RTRIM(e.NewICNo) as nik
            FROM HR_GANGLN gl
            JOIN HR_EMPLOYEE e ON gl.GangMember = e.EmpCode
            WHERE RTRIM(gl.GangCode) = ?
        `, [gc]);

        if (members.length === 0) continue;

        let ecMatch = 0, nikMatch = 0, missing = 0;
        for (const m of members) {
            const ec = (m.emp_code || '').trim().toUpperCase();
            const nik = (m.nik || '').trim().toUpperCase();
            
            if (thrByEc.has(ec)) ecMatch++;
            else if (thrByNik.has(nik)) nikMatch++;
            else missing++;
        }

        totalMembers += members.length;
        totalEcMatch += ecMatch;
        totalNikMatch += nikMatch;
        totalMissing += missing;

        const matchPct = Math.round(((ecMatch + nikMatch) / members.length) * 100);
        
        if (missing > 0) {
            worstGangs.push({ gang: gc, missing, members: members.length });
        }

        log(`${gc.padEnd(8)} | ${String(members.length).padEnd(8)} | ${String(ecMatch).padEnd(10)} | ${String(nikMatch).padEnd(10)} | ${String(missing).padEnd(8)} | ${matchPct}%`);
    }

    log(`\n=== TOTALS ===`);
    log(`Total members: ${totalMembers}`);
    log(`EC match: ${totalEcMatch}`);
    log(`NIK match: ${totalNikMatch}`);
    log(`Missing: ${totalMissing}`);
    log(`Match rate: ${Math.round(((totalEcMatch + totalNikMatch) / totalMembers) * 100)}%`);

    // Show worst gangs
    worstGangs.sort((a, b) => b.missing - a.missing);
    log(`\n=== GANGS WITH MOST MISSING THR ===`);
    for (const wg of worstGangs.slice(0, 20)) {
        log(`${wg.gang}: ${wg.missing} missing out of ${wg.members}`);
    }

    // Check: How many THR records have EMPTY emp_code?
    const emptyEcCount = allThr.filter((t: any) => !(t.emp_code || '').trim()).length;
    log(`\nTHR records with empty emp_code: ${emptyEcCount} / ${allThr.length}`);

    const outPath = join(__dirname, '..', '..', 'diagnose_all_gangs.txt');
    writeFileSync(outPath, lines.join('\n'), 'utf-8');
    console.log(`Results written to ${outPath}`);
    console.log(`Summary: EC=${totalEcMatch}, NIK=${totalNikMatch}, Missing=${totalMissing}/${totalMembers}`);
    
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
