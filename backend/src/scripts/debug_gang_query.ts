/**
 * Debug script: Test HR_GANG query on different databases/profiles
 * Run: cd backend && bun run src/scripts/debug_gang_query.ts
 */
import { Database } from "../db/client";
import { Config } from "../config";

async function testGangQuery() {
    console.log("=== Debug: HR_GANG Query ===");
    console.log(`DB_API_URL: ${Config.DB_API_URL}`);
    console.log(`DB_API_KEY: ${Config.DB_API_KEY ? "SET" : "NOT SET"}`);
    console.log(`DB_PROFILE: ${Config.DB_PROFILE}`);
    console.log(`DB_DATABASE (DEFAULT): ${Config.DEFAULT_DATABASE}`);
    console.log(`DB_EXTEND_DATABASE: ${Config.DB_EXTEND_DATABASE}`);
    console.log(`DB_EXTEND_PROFILE: ${Config.DB_EXTEND_PROFILE}`);
    console.log("");

    // Test 1: Default database (db_ptrj with SERVER_PROFILE_1)
    console.log("--- Test 1: db_ptrj with SERVER_PROFILE_1 ---");
    try {
        const db = Database.getInstance();
        const rows1 = await db.query("SELECT TOP 5 GangCode, Description, LocCode FROM HR_GANG ORDER BY GangCode");
        console.log(`Found ${rows1.length} rows`);
        console.log(JSON.stringify(rows1, null, 2));
    } catch (e: any) {
        console.error(`ERROR: ${e.message}`);
    }
    console.log("");

    // Test 2: extend_db_ptrj with SERVER_PROFILE_1
    console.log("--- Test 2: extend_db_ptrj with SERVER_PROFILE_1 ---");
    try {
        const db2 = Database.getInstance(Config.DB_EXTEND_DATABASE, Config.DB_EXTEND_PROFILE);
        const rows2 = await db2.query("SELECT TOP 5 GangCode, Description, LocCode FROM HR_GANG ORDER BY GangCode");
        console.log(`Found ${rows2.length} rows`);
        console.log(JSON.stringify(rows2, null, 2));
    } catch (e: any) {
        console.error(`ERROR: ${e.message}`);
    }
    console.log("");

    // Test 3: Check LocCode values in db_ptrj
    console.log("--- Test 3: Check DISTINCT LocCode in HR_GANG (db_ptrj) ---");
    try {
        const db = Database.getInstance();
        const rows3 = await db.query("SELECT DISTINCT RTRIM(LocCode) as LocCode FROM HR_GANG ORDER BY LocCode");
        console.log(`Found ${rows3.length} distinct LocCodes`);
        console.log(JSON.stringify(rows3, null, 2));
    } catch (e: any) {
        console.error(`ERROR: ${e.message}`);
    }
    console.log("");

    // Test 4: Simulate what DivisionConfigService does for AB1
    console.log("--- Test 4: Query HR_GANG for AB1 aliases (db_ptrj) ---");
    try {
        const db = Database.getInstance();
        const aliases = ["AB1", "AB-1", "ARB1", "arb1", "AFDELING1", "AFD1", "Air Ruak 1"];
        const placeholders = aliases.map(() => "?").join(",");
        const rows4 = await db.query(`
            SELECT GangCode, Description, LocCode
            FROM HR_GANG
            WHERE RTRIM(LocCode) IN (${placeholders})
            ORDER BY GangCode
        `, aliases);
        console.log(`Found ${rows4.length} gangs for AB1 aliases`);
        if (rows4.length > 0) {
            console.log(JSON.stringify(rows4, null, 2));
        } else {
            console.log("NO ROWS returned! Check if LocCode values match.");
        }
    } catch (e: any) {
        console.error(`ERROR: ${e.message}`);
    }
    console.log("");

    // Test 5: Query ALL gangs with LocCode
    console.log("--- Test 5: ALL gangs with LocCode (db_ptrj) ---");
    try {
        const db = Database.getInstance();
        const rows5 = await db.query("SELECT GangCode, Description, LocCode FROM HR_GANG ORDER BY LocCode, GangCode");
        console.log(`Total gangs: ${rows5.length}`);
        // Group by LocCode
        const byLoc: Record<string, number> = {};
        for (const row of rows5) {
            const loc = (row.LocCode || "").trim();
            byLoc[loc] = (byLoc[loc] || 0) + 1;
        }
        console.log("Gangs by LocCode:");
        console.log(JSON.stringify(byLoc, null, 2));
    } catch (e: any) {
        console.error(`ERROR: ${e.message}`);
    }
}

testGangQuery().catch(console.error);