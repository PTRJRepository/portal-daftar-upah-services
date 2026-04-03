import { Database } from '../db/client';

async function main() {
    const db = Database.getExtendedInstance();
    const mainDb = Database.getInstance();
    const month = 3, year = 2026;

    // Check: are the missing E2H employees in history_gang_member?
    const missingEmpCodes = ['E0031','E0155','E0363','E0364','E0403','E0460','E0461','E0468','E0470','E0477','E0479','E0558','E0568','E0576','E0577'];

    console.log(`=== Check history_gang_member for missing E2H employees ===`);
    
    for (const ec of missingEmpCodes) {
        // Check in history_gang_member
        const hist = await db.query<any>(`
            SELECT emp_code, gang_code, period_month, period_year, is_active
            FROM history_gang_member
            WHERE RTRIM(emp_code) = ? AND period_month = ? AND period_year = ?
        `, [ec, month, year]);

        // Check in HR_GANGLN (current)
        const curr = await mainDb.query<any>(`
            SELECT RTRIM(GangMember) as ec, RTRIM(GangCode) as gc
            FROM HR_GANGLN WHERE RTRIM(GangMember) = ?
        `, [ec]);

        const histInfo = hist.length > 0 ? `gang=${hist[0].gang_code}, active=${hist[0].is_active}` : '❌ NOT IN HISTORY';
        const currInfo = curr.length > 0 ? `gang=${curr[0].gc}` : '❌ NOT IN CURRENT';
        
        console.log(`${ec}: history=${histInfo} | current=${currInfo}`);
    }

    // Count total history vs current
    const totalHist = await db.query<any>(`
        SELECT COUNT(DISTINCT emp_code) as cnt FROM history_gang_member
        WHERE period_month = ? AND period_year = ? AND is_active = 1
    `, [month, year]);
    const totalCurr = await mainDb.query<any>(`
        SELECT COUNT(DISTINCT GangMember) as cnt FROM HR_GANGLN
    `);
    console.log(`\nTotal: history_gang_member(${month}/${year})=${totalHist[0]?.cnt}, HR_GANGLN(current)=${totalCurr[0]?.cnt}`);
    
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
