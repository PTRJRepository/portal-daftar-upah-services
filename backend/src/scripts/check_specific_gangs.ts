
import { Database } from "../db/client";

async function checkSpecificGangs() {
    const db = Database.getInstance();

    console.log("Checking HR_GANG for HM and HMC...");

    const gangs = await db.query(`
        SELECT GangCode, Description, LocCode
        FROM HR_GANG 
        WHERE GangCode IN ('HM', 'HMC')
    `);

    gangs.forEach((g: any) => {
        console.log(`Gang: ${g.GangCode}, Desc: ${g.Description}, Loc: ${g.LocCode}`);
    });
}

checkSpecificGangs().catch(console.error);
