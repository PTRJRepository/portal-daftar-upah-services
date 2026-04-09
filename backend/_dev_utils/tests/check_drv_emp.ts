import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== Employees in DRV gang ===\n");
    const drv = await db.query<any>(`
        SELECT gl.GangCode, e.EmpCode, e.EmpName, e.LocCode
        FROM HR_GANGLN gl
        INNER JOIN HR_EMPLOYEE e ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        WHERE gl.GangCode = 'DRV'
    `);
    console.log(`DRV employees: ${drv.length}`);
    drv.forEach(r => console.log(`  ${r.EmpCode} | ${r.EmpName} | e.LocCode=${r.LocCode}`));
}

main().catch(console.error);
