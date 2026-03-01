import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();

    console.log("Checking HR_GANGLN for J0843...");
    const rows = await db.query(`
        SELECT top 10 GangCode, GangMember FROM HR_GANGLN WHERE RTRIM(GangMember) = 'J0843'
    `);
    console.table(rows);

    const arcGangs = await db.query(`
        SELECT gl.*, g.Description FROM PR_GANGLN_ARC gl JOIN PR_GANG g ON gl.MasterID = g.ID WHERE RTRIM(gl.EmpCode) = 'J0843'
    `);
    console.table(arcGangs);
}

main().catch(console.error).finally(() => process.exit(0));
