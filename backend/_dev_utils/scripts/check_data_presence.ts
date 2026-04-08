import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    // Check for March 2026 data in PR_TASKREGLN for DME and IJL
    const startDate = "2026-03-01";
    const endDate = "2026-04-01";

    console.log(`Checking PR_TASKREGLN for March 2026 (${startDate} to ${endDate}):`);
    
    const dmeData = await db.queryOne<{count: number}>(`
        SELECT COUNT(*) as count 
        FROM PR_TASKREGLN trl
        JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
        JOIN PR_GANG g ON g.GangCode = tr.GangCode
        WHERE g.LocCode = 'DME' AND trl.TrxDate >= ? AND trl.TrxDate < ?
    `, [startDate, endDate]);
    console.log(`DME (Dempo) rows in PR_TASKREGLN: ${dmeData?.count}`);

    const ijlData = await db.queryOne<{count: number}>(`
        SELECT COUNT(*) as count 
        FROM PR_TASKREGLN trl
        JOIN PR_TASKREG tr ON tr.ID = trl.MasterID
        JOIN PR_GANG g ON g.GangCode = tr.GangCode
        WHERE g.LocCode = 'IJL' AND trl.TrxDate >= ? AND trl.TrxDate < ?
    `, [startDate, endDate]);
    console.log(`IJL (Ijuk) rows in PR_TASKREGLN: ${ijlData?.count}`);

    // Also check archived tables just in case
    console.log("\nChecking PR_TASKREGLN_ARC for March 2026:");
    const dmeArcData = await db.queryOne<{count: number}>(`
        SELECT COUNT(*) as count 
        FROM PR_TASKREGLN_ARC trl
        JOIN PR_GANG g ON g.ID = trl.MasterID
        WHERE g.LocCode = 'DME' AND trl.TrxDate >= ? AND trl.TrxDate < ?
    `, [startDate, endDate]);
    console.log(`DME (Dempo) rows in PR_TASKREGLN_ARC: ${dmeArcData?.count}`);

}

main().catch(console.error);
