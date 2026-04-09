import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== SEMUA gang di ARA dari HR_GANGLN ===\n");
    
    const rows = await db.query<any>(`
        SELECT DISTINCT
            gl.GangCode as gang_code,
            e.LocCode as loc_code
        FROM HR_GANGLN gl
        INNER JOIN HR_EMPLOYEE e ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        WHERE RTRIM(e.LocCode) = 'ARA'
        ORDER BY gl.GangCode
    `);
    
    console.log(`Total gangs di ARA: ${rows.length}\n`);
    rows.forEach(r => console.log(`  ${r.gang_code} | ${r.loc_code}`));
}

main().catch(console.error);
