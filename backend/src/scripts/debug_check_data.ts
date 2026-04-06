/**
 * Debug Check Data Availability
 * Run: cd backend && bun run src/scripts/debug_check_data.ts
 */

import { Database } from "../db/client";

async function main() {
    console.log("=== CHECK DATA AVAILABILITY ===\n");

    const db = Database.getExtendedInstance();

    // 1. Check table structure
    console.log("1. Check table columns...");
    try {
        const cols = await db.query<any>("SELECT TOP 3 * FROM daftar_upah_aggregation_history WHERE month = ? AND year = ?", [3, 2026]);
        console.log("   Sample columns:", Object.keys(cols[0] || {}));
        console.log("   Sample row:", cols[0]);
    } catch (e: any) {
        console.log("   ERROR:", e.message);
    }

    // 2. Check what data exists
    console.log("\n2. Check all data for March 2026...");
    try {
        const data = await db.query<any>("SELECT * FROM daftar_upah_aggregation_history WHERE month = ? AND year = ?", [3, 2026]);
        console.log("   Total rows:", data.length);

        // Group by division
        const byDiv: Record<string, number> = {};
        const byGang: Record<string, number> = {};
        for (const row of data) {
            const div = row.division_code || 'NULL';
            const gang = row.gang_code || 'NULL';
            byDiv[div] = (byDiv[div] || 0) + 1;
            byGang[gang] = (byGang[gang] || 0) + 1;
        }
        console.log("   By Division:", byDiv);
        console.log("   Sample gangs:", Object.keys(byGang).slice(0, 20));
    } catch (e: any) {
        console.log("   ERROR:", e.message);
    }

    // 3. Check if DME data exists specifically
    console.log("\n3. Check DME specifically...");
    try {
        const dme = await db.query<any>("SELECT * FROM daftar_upah_aggregation_history WHERE month = ? AND year = ? AND division_code LIKE ?", [3, 2026, '%DME%']);
        console.log("   DME rows:", dme.length);
        if (dme.length > 0) {
            console.log("   DME gangs:", [...new Set(dme.map(r => r.gang_code))]);
        }
    } catch (e: any) {
        console.log("   ERROR:", e.message);
    }

    console.log("\n=== DONE ===");
}

main().catch(console.error);