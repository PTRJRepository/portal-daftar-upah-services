import { Database } from '../db/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
    const db = Database.getExtendedInstance();
    const mainDb = Database.getInstance();
    const month = 3, year = 2026;
    const lines: string[] = [];
    const log = (m: string) => lines.push(m);

    const missingEmpCodes = ['E0031','E0155','E0363','E0364','E0403','E0460','E0461','E0468','E0470','E0477','E0479','E0558','E0568','E0576','E0577'];

    log(`=== Check history_gang_member for missing ===`);
    
    for (const ec of missingEmpCodes) {
        const hist = await db.query<any>(`
            SELECT emp_code, gang_code, period_month, period_year, is_active
            FROM history_gang_member
            WHERE RTRIM(emp_code) = ? AND period_month = ? AND period_year = ?
        `, [ec, month, year]);

        const curr = await mainDb.query<any>(`
            SELECT RTRIM(GangMember) as ec, RTRIM(GangCode) as gc
            FROM HR_GANGLN WHERE RTRIM(GangMember) = ?
        `, [ec]);

        const histInfo = hist.length > 0 ? `history:gang=${hist[0].gang_code},active=${hist[0].is_active}` : 'NO_HISTORY';
        const currInfo = curr.length > 0 ? `current:gang=${curr[0].gc}` : 'NO_CURRENT';
        log(`${ec}: ${histInfo} | ${currInfo}`);
    }

    // Count totals
    const totalHist = await db.query<any>(`
        SELECT COUNT(DISTINCT emp_code) as cnt FROM history_gang_member
        WHERE period_month = ? AND period_year = ? AND is_active = 1
    `, [month, year]);
    const totalCurr = await mainDb.query<any>(`
        SELECT COUNT(DISTINCT GangMember) as cnt FROM HR_GANGLN
    `);
    log(`\nhistory_gang_member(${month}/${year},active=1): ${totalHist[0]?.cnt}`);
    log(`HR_GANGLN(current): ${totalCurr[0]?.cnt}`);

    // Check what periods exist in history_gang_member  
    const periods = await db.query<any>(`
        SELECT period_month, period_year, COUNT(DISTINCT emp_code) as cnt
        FROM history_gang_member WHERE is_active = 1
        GROUP BY period_month, period_year ORDER BY period_year, period_month
    `);
    log(`\nAll periods in history_gang_member:`);
    for (const p of periods) {
        log(`  ${p.period_month}/${p.period_year}: ${p.cnt} active members`);
    }

    // THR was generated for 1616 employees. Where did it source those employees?
    // Check employee_other_incomes gang_code distribution
    const thrGangs = await db.query<any>(`
        SELECT RTRIM(gang_code) as gc, COUNT(*) as cnt
        FROM employee_other_incomes
        WHERE period_year = ? AND period_month = ? AND income_type = 'THR'
        GROUP BY gang_code ORDER BY gang_code
    `, [year, month]);
    log(`\nTHR records by gang_code:`);
    let thrTotal = 0;
    for (const g of thrGangs) {
        log(`  ${g.gc}: ${g.cnt}`);
        thrTotal += g.cnt;
    }
    log(`Total THR: ${thrTotal}`);

    writeFileSync(join(__dirname, '..', '..', 'check_history_result.txt'), lines.join('\n'), 'utf-8');
    console.log('Done');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
