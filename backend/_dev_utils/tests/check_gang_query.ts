import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== Checking HR_GANG table ===\n");
    
    // Check gangs for ARA (F prefix) with PERCOBAAN
    const rows1 = await db.query<any>(`
        SELECT GangCode, Description, LocCode 
        FROM HR_GANG 
        WHERE GangCode LIKE 'F1%' 
        ORDER BY GangCode
    `);
    console.log(`HR_GANG - F1* gangs: ${rows1.length} rows`);
    rows1.forEach(r => {
        console.log(`  ${r.GangCode} | ${r.LocCode} | ${r.Description}`);
    });
    
    console.log("\n=== Checking HR_GANGLN table ===\n");
    
    // Check gangs for ARA in HR_GANGLN
    const rows2 = await db.query<any>(`
        SELECT DISTINCT GangCode, GangMember 
        FROM HR_GANGLN 
        WHERE GangCode LIKE 'F1%' 
        ORDER BY GangCode
    `);
    console.log(`HR_GANGLN - F1* gangs: ${rows2.length} rows`);
    rows2.forEach(r => {
        console.log(`  ${r.GangCode} | ${r.GangMember}`);
    });
    
    console.log("\n=== Checking HR_GANG for ALL gangs with 'PERCOBAAN' in description ===\n");
    const percobaan = await db.query<any>(`
        SELECT GangCode, Description, LocCode 
        FROM HR_GANG 
        WHERE Description LIKE '%PERCOBAAN%'
        ORDER BY GangCode
    `);
    console.log(`HR_GANG with PERCOBAAN: ${percobaan.length} rows`);
    percobaan.forEach(r => {
        console.log(`  ${r.GangCode} | ${r.LocCode} | ${r.Description}`);
    });
    
    console.log("\n=== Checking HR_GANG for LocCode = 'ARA' ===\n");
    const araGangs = await db.query<any>(`
        SELECT GangCode, Description, LocCode 
        FROM HR_GANG 
        WHERE UPPER(RTRIM(LocCode)) = 'ARA'
        ORDER BY GangCode
    `);
    console.log(`HR_GANG with LocCode=ARA: ${araGangs.length} rows`);
    araGangs.forEach(r => {
        console.log(`  ${r.GangCode} | ${r.LocCode} | ${r.Description}`);
    });
}

main().catch(console.error);
