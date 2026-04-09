import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== ARA gangs from HR_GANG ===\n");
    const araGangs = await db.query<any>(`
        SELECT GangCode, Description, LocCode
        FROM HR_GANG
        WHERE UPPER(RTRIM(LocCode)) = 'ARA'
        ORDER BY GangCode
    `);
    console.log(`ARA gangs in HR_GANG: ${araGangs.length}`);
    araGangs.forEach(r => console.log(`  ${r.GangCode} | ${r.LocCode} | ${r.Description?.trim()}`));
    
    console.log("\n=== ARA gangs from HR_GANG (excluding workshop/infra) ===\n");
    const filtered = araGangs.filter(r => {
        const desc = r.Description?.toUpperCase() || '';
        return !desc.includes('WORKSHOP') && !desc.includes('INFRA');
    });
    console.log(`Filtered ARA gangs: ${filtered.length}`);
    filtered.forEach(r => console.log(`  ${r.GangCode} | ${r.LocCode} | ${r.Description?.trim()}`));
}

main().catch(console.error);
