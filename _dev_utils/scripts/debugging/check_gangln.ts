/**
 * Quick HR_GANGLN check
 */
import { Database } from "../../../backend/src/db/client";

async function main() {
    const db = Database.getInstance();
    const all = await db.query(`SELECT TOP 5 GangCode, GangMember FROM HR_GANGLN ORDER BY GangCode`);
    console.log('HR_GANGLN top 5:', JSON.stringify(all));
    const count = await db.query(`SELECT COUNT(*) as cnt FROM HR_GANGLN`);
    console.log('Total HR_GANGLN rows:', count[0]?.cnt);
    const l1h = await db.query(`SELECT COUNT(*) as cnt FROM HR_GANGLN WHERE UPPER(RTRIM(GangCode)) = 'L1H'`);
    console.log('L1H members count:', l1h[0]?.cnt);
}
main().catch(console.error);
