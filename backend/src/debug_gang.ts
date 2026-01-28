import { Database } from "./db/client";

async function debugGang() {
    const db = Database.getInstance();
    // Connection is handled via HTTP gateway, no explicit connect needed

    console.log("--- Debugging Gang Mismatch ---");

    // 1. Check RAHMAT IQBAL's gang memberships
    const employeeName = "RAHMAT IQBAL";
    console.log(`\n1. Checking memberships for ${employeeName}...`);
    const employeeRows = await db.query(`
        SELECT e.EmpCode, e.EmpName, g.GangCode, gang.Description
        FROM HR_EMPLOYEE e
        JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
        LEFT JOIN HR_GANG gang ON gang.GangCode = g.GangCode
        WHERE e.EmpName LIKE '%${employeeName}%'
    `);
    console.log(JSON.stringify(employeeRows, null, 2));

    // 2. Check A1H Gang Members (Limit 5)
    const targetGang = "A1H";
    console.log(`\n2. First 5 members of gang ${targetGang}...`);
    const gangRows = await db.query(`
        SELECT TOP 5 e.EmpCode, e.EmpName
        FROM HR_EMPLOYEE e
        JOIN HR_GANGLN g ON g.GangMember = e.EmpCode
        WHERE g.GangCode = '${targetGang}'
    `);
    console.log(JSON.stringify(gangRows, null, 2));

    // 3. Check A1H Gang Info
    console.log(`\n3. Info for gang ${targetGang}...`);
    const gangInfo = await db.query(`
        SELECT * FROM HR_GANG WHERE GangCode = '${targetGang}'
    `);
    console.log(JSON.stringify(gangInfo, null, 2));

    process.exit(0);
}

debugGang().catch(console.error);
