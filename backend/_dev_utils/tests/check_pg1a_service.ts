import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    const placeholders = "?,?,?,?,?";
    const aliases = ["P1A","P1a","pg1a","PLASMA1A","Plasma 1A"];
    
    // Correct query - params must be duplicated for both IN clauses
    const query = `
        SELECT DISTINCT
            RTRIM(g.GangCode) as gang_code,
            RTRIM(g.Description) as description,
            RTRIM(g.LocCode) as loc_code
        FROM HR_GANGLN gl
        INNER JOIN HR_GANG g ON gl.GangCode = g.GangCode
        INNER JOIN HR_EMPLOYEE e ON gl.GangMember = e.EmpCode
        WHERE (RTRIM(e.LocCode) IN (${placeholders}) OR RTRIM(g.LocCode) IN (${placeholders}))
          AND g.GangCode NOT IN ('IN', 'INT', 'AMC')
          AND (g.Description IS NULL OR (g.Description NOT LIKE '%WORKSHOP%' AND g.Description NOT LIKE '%INFRA%'))
        ORDER BY RTRIM(g.GangCode)
    `;
    
    // Pass params twice (once for each IN clause)
    const rows = await db.query<any>(query, [...aliases, ...aliases]);
    console.log(`Result with duplicated params: ${rows.length} rows`);
    rows.forEach(r => console.log(`  ${r.gang_code} | ${r.loc_code} | ${r.description}`));
}

main().catch(console.error);
