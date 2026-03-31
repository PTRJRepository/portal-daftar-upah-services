import { Database } from "./src/db/client";
import { currentPeriodService } from "./src/services/currentPeriodService";

async function check() {
    const db = Database.getInstance();
    const month = 3;
    const year = 2026;

    console.log(`Checking data for March 2026 (Calendar Month ${month}, Year ${year})...`);

    // 1. Check HR_GANGLN (Live)
    const hrGanglnRows = await db.query(`SELECT COUNT(*) as count FROM HR_GANGLN`);
    console.log(`Total rows in HR_GANGLN (Live):`, hrGanglnRows[0].count);

    // 2. Check PR_GANGLN_ARC (Archive) for March 2026
    const { accMonth, accYear } = currentPeriodService.calendarToAccMonth(month, year);
    console.log(`March 2026 maps to AccMonth ${accMonth}, AccYear ${accYear}`);

    const prGanglnArcRows = await db.query(`
        SELECT COUNT(*) as count 
        FROM PR_GANGLN_ARC 
        WHERE AccMonth = ? AND AccYear = ?
    `, [accMonth, accYear]);
    console.log(`Rows in PR_GANGLN_ARC for AccMonth ${accMonth}, AccYear ${accYear}:`, prGanglnArcRows[0].count);

    // 3. Check PR_TASKREGLN (Live Transactions) for March 2026
    const prTaskReglnRows = await db.query(`
        SELECT COUNT(*) as count 
        FROM PR_TASKREGLN 
        WHERE TrxDate >= '2026-03-01' AND TrxDate < '2026-04-01'
    `);
    console.log(`Rows in PR_TASKREGLN for March 2026:`, prTaskReglnRows[0].count);

    // 4. Check PR_TASKREGLN_ARC (Archived Transactions) for March 2026
    const prTaskReglnArcRows = await db.query(`
        SELECT COUNT(*) as count 
        FROM PR_TASKREGLN_ARC 
        WHERE TrxDate >= '2026-03-01' AND TrxDate < '2026-04-01'
    `);
    console.log(`Rows in PR_TASKREGLN_ARC for March 2026:`, prTaskReglnArcRows[0].count);

    // 5. Check latest TrxDate in PR_TASKREGLN
    const latestTrxDate = await db.query(`SELECT MAX(TrxDate) as latest FROM PR_TASKREGLN`);
    console.log(`Latest TrxDate in PR_TASKREGLN:`, latestTrxDate[0].latest);

    // 6. Check Current Period as per Service
    const currentPeriod = await currentPeriodService.getCurrentPeriod();
    console.log(`Current Period from Service: month=${currentPeriod.month}, year=${currentPeriod.year}, latest_trx_date=${currentPeriod.latest_trx_date}`);

    process.exit(0);
}

check().catch(err => {
    console.error(err);
    process.exit(1);
});
