import { Database } from "../../src/db/client";

async function main() {
    const db = Database.getInstance();
    
    const percobaan = ['A1P', 'A2P', 'A3P', 'B1P', 'B3P', 'C1P', 'C2P', 'C3P', 'D2P', 'E1P', 'E2P', 'E3P', 'F1B', 'F2', 'J1P', 'J2P', 'J3P', 'J1U', 'J3U'];
    
    console.log("=== PERCOBAAN gangs - member count in HR_GANGLN ===\n");
    for (const gang of percobaan) {
        const rows = await db.query<any>(`
            SELECT COUNT(*) as cnt FROM HR_GANGLN WHERE GangCode = ?
        `, [gang]);
        console.log(`  ${gang}: ${rows[0].cnt} members`);
    }
}

main().catch(console.error);
