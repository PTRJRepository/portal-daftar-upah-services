import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== Testing ARA gangs via DivisionConfigService logic ===\n");
    
    const placeholders = "?,?,?";
    const aliases = ["ARA","ara","Area"];
    
    // 1. HR_GANG query (should include F1B, F2, F1BHL? - F1BHL not in HR_GANG)
    const gangQuery = `
        SELECT DISTINCT
            RTRIM(GangCode) as gang_code,
            RTRIM(Description) as description,
            RTRIM(LocCode) as loc_code
        FROM HR_GANG
        WHERE RTRIM(LocCode) IN (${placeholders})
          AND (Description IS NULL OR (Description NOT LIKE '%WORKSHOP%' AND Description NOT LIKE '%INFRA%'))
        ORDER BY RTRIM(GangCode)
    `;
    const gangRows = await db.query<any>(gangQuery, aliases);
    console.log(`HR_GANG ARA gangs: ${gangRows.length}`);
    gangRows.forEach(r => console.log(`  ${r.gang_code} | ${r.loc_code} | ${r.description}`));
    
    console.log("\n=== HR_GANGLN orphaned gangs for ARA ===");
    // 2. Orphaned query - F1BHL is in HR_GANGLN with LocCode = ARA from employee
    const orphanedQuery = `
        SELECT DISTINCT
            RTRIM(gl.GangCode) as gang_code,
            'GANG TANPA DESKRIPSI' as description,
            RTRIM(e.LocCode) as loc_code
        FROM HR_GANGLN gl
        INNER JOIN HR_EMPLOYEE e ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        LEFT JOIN HR_GANG g ON RTRIM(gl.GangCode) = RTRIM(g.GangCode)
        WHERE g.GangCode IS NULL
          AND RTRIM(e.LocCode) IN (${placeholders})
    `;
    const orphanedRows = await db.query<any>(orphanedQuery, aliases);
    console.log(`HR_GANGLN orphaned: ${orphanedRows.length}`);
    orphanedRows.forEach(r => console.log(`  ${r.gang_code} | ${r.loc_code} | ${r.description}`));
}

main().catch(console.error);
