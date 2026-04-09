import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    console.log("=== PERCOBAAN gangs WITHOUT members - check if they exist in HR_GANGLN with different codes ===\n");
    const noMembers = ['A1P', 'A2P', 'A3P', 'B1P', 'B1B', 'B3B', 'E1P', 'F1B', 'F2', 'J1P', 'J1U', 'J2P'];
    for (const gang of noMembers) {
        // Check what employees with that prefix have in HR_GANGLN
        const prefix = gang.charAt(0);
        const similar = await db.query<any>(`
            SELECT DISTINCT g.GangCode, COUNT(*) as cnt
            FROM HR_GANGLN g
            WHERE g.GangCode LIKE '${prefix}1%'
            GROUP BY g.GangCode
            ORDER BY g.GangCode
        `);
        const hasMembers = similar.some(r => r.GangCode === gang);
        console.log(`\n${gang}:`);
        console.log(`  In HR_GANGLN: ${hasMembers ? 'YES' : 'NO (missing)'}`);
        console.log(`  Similar codes:`);
        similar.forEach(r => console.log(`    ${r.GangCode} - ${r.cnt} members`));
    }
}

main().catch(console.error);
