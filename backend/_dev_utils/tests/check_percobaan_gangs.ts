import { Database } from '../../src/db/client';

async function checkGangLn() {
    const db = Database.getInstance();
    try {
        const gangs = ['A1P', 'F1B', 'E2P', 'J1P', 'C1P'];
        for (const g of gangs) {
            const hrCount = await db.query(`SELECT COUNT(*) as c FROM HR_GANGLN WHERE RTRIM(GangCode) = ?`, [g]);
            const prCount = await db.query(`SELECT COUNT(*) as c FROM PR_GANGLN_ARC WHERE MasterID IN (SELECT ID FROM PR_GANG WHERE RTRIM(GangID) = ?)`, [g]);
            console.log(`Gang ${g} - HR_GANGLN: ${hrCount[0].c}, PR_GANGLN_ARC: ${prCount[0].c}`);
        }
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}

checkGangLn();
