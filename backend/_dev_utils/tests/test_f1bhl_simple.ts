import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== Simple F1BHL query without HR_GANG join ===\n");
    
    const query = `
        SELECT DISTINCT
            RTRIM(gl.GangCode) as gang_code,
            RTRIM(e.LocCode) as loc_code
        FROM HR_GANGLN gl
        INNER JOIN HR_EMPLOYEE e ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        WHERE RTRIM(e.LocCode) = 'ARA'
        ORDER BY RTRIM(gl.GangCode)
    `;
    
    const rows = await db.query<any>(query, []);
    console.log(`Query returned ${rows.length} rows`);
    rows.forEach(r => console.log(`  ${r.gang_code} | ${r.loc_code}`));
}

main().catch(console.error);
