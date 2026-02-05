
import { Database } from "../db/client";

async function checkGangs() {
    const db = Database.getInstance();

    const divisions = ['AB2', 'P1A', 'AB1', 'PG1A'];

    console.log("Checking gangs for divisions:", divisions);

    for (const div of divisions) {
        console.log(`\n--- Division ${div} ---`);
        const gangs = await db.query(`
            SELECT GangCode, Description, LocCode
            FROM HR_GANG 
            WHERE RTRIM(LocCode) = '${div}'
        `);

        if (gangs.length === 0) {
            console.log("No gangs found for this division.");
        } else {
            console.log(`Found ${gangs.length} gangs.`);
            gangs.forEach((g: any) => {
                const desc = g.Description || "";
                if (desc.toUpperCase().includes("WORKSHOP") || g.GangCode.includes("HM")) {
                    console.log(`MATCH Gang: ${g.GangCode}, Desc: ${desc}, Loc: ${g.LocCode}`);
                }
            });
        }
    }
}

checkGangs().catch(console.error);
