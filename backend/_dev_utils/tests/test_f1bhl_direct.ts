import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== Test F1BHL query directly ===\n");
    
    const query = `
        SELECT DISTINCT
            RTRIM(gl.GangCode) as gang_code,
            RTRIM(ISNULL(h.Description, 'GANG TANPA DESKRIPSI')) as description,
            RTRIM(e.LocCode) as loc_code
        FROM HR_GANGLN gl
        INNER JOIN HR_EMPLOYEE e ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        LEFT JOIN HR_GANG h ON RTRIM(gl.GangCode) = RTRIM(h.GangCode)
        WHERE RTRIM(e.LocCode) = 'ARA'
          AND (h.Description NOT LIKE '%WORKSHOP%' AND h.Description NOT LIKE '%INFRA%')
        ORDER BY RTRIM(gl.GangCode)
    `;
    
    const rows = await db.query<any>(query, []);
    console.log(`Query returned ${rows.length} rows`);
    
    const f1bhl = rows.find(r => r.gang_code === 'F1BHL');
    if (f1bhl) {
        console.log(`F1BHL found: ${JSON.stringify(f1bhl)}`);
    } else {
        console.log(`F1BHL NOT found in results`);
        console.log(`First 10 rows:`);
        rows.slice(0, 10).forEach(r => console.log(`  ${r.gang_code} | ${r.loc_code} | ${r.description}`));
    }
}

main().catch(console.error);
