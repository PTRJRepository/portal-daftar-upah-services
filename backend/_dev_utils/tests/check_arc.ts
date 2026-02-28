import { Database } from "../../src/db/client";

async function checkARC() {
    const db = Database.getInstance(undefined, "SERVER_PROFILE_2");

    // Check what LocCodes match ARC or AREC
    const locRows = await db.query(`
        SELECT DISTINCT LocCode
        FROM HR_GANG
        WHERE LocCode LIKE '%AR%' OR LocCode LIKE '%AC%' OR LocCode LIKE '%AREC%'
    `);
    console.log("LocCodes containing AR or AC or AREC:", locRows);

    // Check what gangs have 'ARC' in description
    const descRows = await db.query(`
        SELECT GangCode, Description, LocCode
        FROM HR_GANG
        WHERE Description LIKE '%ARC%' OR Description LIKE '%AREC%'
    `);
    console.log("Gangs with ARC/AREC in description:", descRows);

    // Check LocCode for ARC explicitly
    const arcRows = await db.query(`
        SELECT COUNT(*) as count
        FROM HR_GANG
        WHERE RTRIM(LTRIM(UPPER(LocCode))) = 'ARC'
    `);
    console.log("Count of ARC LocCode explicitly:", arcRows);
}

checkARC().catch(console.error);
