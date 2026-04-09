import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== Check orphaned gangs (in GANGLN but not in HR_GANG) ===\n");
    const orphaned = await db.query<any>(`
        SELECT DISTINCT
            RTRIM(gl.GangCode) as gang_code,
            'GANGTANPA DESKRIPSI' as description,
            RTRIM(e.LocCode) as loc_code
        FROM HR_GANGLN gl
        INNER JOIN HR_EMPLOYEE e ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        LEFT JOIN HR_GANG g ON RTRIM(gl.GangCode) = RTRIM(g.GangCode)
        WHERE g.GangCode IS NULL
        ORDER BY gl.GangCode
    `);
    console.log(`Orphaned gangs: ${orphaned.length}`);
    orphaned.forEach(r => console.log(`  ${r.gang_code} | ${r.loc_code} | ${r.description}`));
}

main().catch(console.error);
