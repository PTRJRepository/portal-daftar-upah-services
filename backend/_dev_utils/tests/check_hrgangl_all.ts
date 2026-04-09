import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== HR_GANGLN - all gangs with 'PERCOBAAN' pattern ===\n");
    const percobaan = await db.query<any>(`
        SELECT DISTINCT g.GangCode, COUNT(*) as cnt
        FROM HR_GANGLN g
        WHERE g.GangCode LIKE '%P' OR g.GangCode LIKE '%B'
        GROUP BY g.GangCode
        ORDER BY g.GangCode
    `);
    console.log(`PERCOBAAN-like gangs: ${percobaan.length}`);
    percobaan.forEach(r => console.log(`  ${r.GangCode} - ${r.cnt} members`));
    
    console.log("\n=== HR_GANGLN - all gangs with F prefix ===\n");
    const fGangs = await db.query<any>(`
        SELECT DISTINCT g.GangCode, COUNT(*) as cnt
        FROM HR_GANGLN g
        WHERE g.GangCode LIKE 'F%'
        GROUP BY g.GangCode
        ORDER BY g.GangCode
    `);
    console.log(`F prefix gangs: ${fGangs.length}`);
    fGangs.forEach(r => console.log(`  ${r.GangCode} - ${r.cnt} members`));
}

main().catch(console.error);
