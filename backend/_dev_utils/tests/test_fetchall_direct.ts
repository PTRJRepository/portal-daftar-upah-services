import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== Direct query for fetchAllGangs ===\n");
    
    const query = `
        SELECT DISTINCT
            RTRIM(gl.GangCode) as gang_code,
            RTRIM(ISNULL(h.Description, 'GANG TANPA DESKRIPSI')) as description,
            RTRIM(e.LocCode) as loc_code
        FROM HR_GANGLN gl
        INNER JOIN HR_EMPLOYEE e ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        LEFT JOIN HR_GANG h ON RTRIM(gl.GangCode) = RTRIM(h.GangCode)
        WHERE (h.Description IS NULL OR (h.Description NOT LIKE '%WORKSHOP%' AND h.Description NOT LIKE '%INFRA%'))
        ORDER BY RTRIM(e.LocCode), RTRIM(gl.GangCode)
    `;
    
    const rows = await db.query<any>(query, []);
    console.log(`Query returned ${rows.length} gangs`);
    
    // Find ARA gangs
    const araRows = rows.filter(r => r.loc_code?.trim() === 'ARA');
    console.log(`\nARA gangs: ${araRows.length}`);
    araRows.forEach(r => console.log(`  ${r.gang_code} | ${r.loc_code} | ${r.description}`));
    
    // Check F1BHL specifically
    const f1bhl = rows.find(r => r.gang_code?.trim() === 'F1BHL');
    if (f1bhl) {
        console.log(`\nF1BHL found: ${JSON.stringify(f1bhl)}`);
    } else {
        console.log(`\nF1BHL NOT found in query results`);
    }
}

main().catch(console.error);
