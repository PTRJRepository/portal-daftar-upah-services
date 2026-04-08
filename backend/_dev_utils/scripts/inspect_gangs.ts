import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("Unique LocCodes in HR_GANG:");
    const locCodes = await db.query<{LocCode: string}>("SELECT DISTINCT LocCode FROM HR_GANG ORDER BY LocCode", []);
    console.table(locCodes);

    console.log("\nGangs for Dempo search:");
    const dmeGangs = await db.query<any>("SELECT GangCode, Description, LocCode FROM HR_GANG WHERE LocCode LIKE '%DME%' OR GangCode LIKE 'E%' OR Description LIKE '%DEMPO%'", []);
    console.log(JSON.stringify(dmeGangs, null, 2));

    console.log("\nGangs for Ijuk search:");
    const ijlGangs = await db.query<any>("SELECT GangCode, Description, LocCode FROM HR_GANG WHERE LocCode LIKE '%IJL%' OR GangCode LIKE 'L%' OR Description LIKE '%IJUK%'", []);
    console.log(JSON.stringify(ijlGangs, null, 2));
}

main().catch(console.error);
