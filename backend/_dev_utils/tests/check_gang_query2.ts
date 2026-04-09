import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== Check HR_GANGLN for F1B specifically ===\n");
    const f1b = await db.query<any>(`
        SELECT DISTINCT GangCode, GangMember 
        FROM HR_GANGLN 
        WHERE GangCode = 'F1B'
    `);
    console.log(`HR_GANGLN with GangCode='F1B': ${f1b.length} rows`);
    f1b.forEach(r => console.log(`  ${r.GangCode} | ${r.GangMember}`));
    
    console.log("\n=== Check HR_GANGLN for all PERCOBAAN gangs ===\n");
    const percobaan = await db.query<any>(`
        SELECT DISTINCT GangCode, COUNT(*) as cnt
        FROM HR_GANGLN 
        WHERE GangCode LIKE '%P' OR GangCode LIKE '%B' AND GangCode != 'F1BHL'
        GROUP BY GangCode
        ORDER BY GangCode
    `);
    console.log(`HR_GANGLN PERCOBAAN-like gangs:`);
    percobaan.forEach(r => console.log(`  ${r.GangCode} | ${r.cnt} members`));
    
    console.log("\n=== Check HR_GANGLN with description containing 'PERCOBAAN' ===\n");
    const percobaan2 = await db.query<any>(`
        SELECT DISTINCT g.GangCode, g.GangMember, h.Description
        FROM HR_GANGLN g
        JOIN HR_GANG h ON g.GangCode = h.GangCode
        WHERE h.Description LIKE '%PERCOBAAN%'
        ORDER BY g.GangCode
    `);
    console.log(`HR_GANGLN with PERCOBAAN description: ${percobaan2.length} rows`);
    percobaan2.forEach(r => console.log(`  ${r.GangCode} | ${r.GangMember} | ${r.Description}`));
}

main().catch(console.error);
