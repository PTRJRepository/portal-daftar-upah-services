import { Database } from "./src/db/client";

async function run() {
    const db = Database.getInstance();

    console.log("=== Divisions ===");
    const divisions = await db.query(`SELECT DISTINCT LocCode FROM HR_GANG ORDER BY LocCode`);
    console.log(divisions.map(d => d.LocCode).join(', '));

    console.log("\n=== Gangs ===");
    const gangs = await db.query(`SELECT GangCode, Description, LocCode FROM HR_GANG ORDER BY LocCode, GangCode`);
    console.log(gangs.slice(0, 20).map(g => `${g.LocCode} | ${g.GangCode} | ${g.Description}`).join('\n'));
    console.log("...");

    process.exit(0);
}

run().catch(console.error);
