/**
 * Test Gang Loading - Debug why gangs don't show on the main page
 */
import { Database } from "../../src/db/client";
import { divisionConfigService } from "../../src/services/config/DivisionConfigService";

async function testGangLoading() {
    console.log("=== GANG LOADING DEBUG ===\n");
    const db = Database.getInstance();

    // Test 1: What's actually in HR_GANG?
    console.log("--- Test 1: All LocCodes in HR_GANG ---");
    const locCodes = await db.query<any>(`SELECT DISTINCT RTRIM(LocCode) as LocCode, COUNT(*) as cnt FROM HR_GANG GROUP BY LocCode ORDER BY LocCode`);
    for (const lc of locCodes) {
        console.log(`  LocCode: "${lc.LocCode}" -> ${lc.cnt} gangs`);
    }

    // Test 2: Try fetching gangs for PG1A division
    console.log("\n--- Test 2: getGangsForDivision('PG1A') ---");
    const pg1aGangs = await divisionConfigService.getGangsForDivision('PG1A');
    console.log(`  Result: ${pg1aGangs.length} gangs`);
    if (pg1aGangs.length > 0) {
        pg1aGangs.slice(0, 5).forEach(g => console.log(`    ${g.gang_code} (${g.loc_code})`));
    }

    // Test 3: What aliases does PG1A resolve to?
    console.log("\n--- Test 3: PG1A aliases ---");
    const pg1aAliases = divisionConfigService.getAliases('PG1A');
    console.log(`  Aliases: ${JSON.stringify(pg1aAliases)}`);
    
    // Test 4: Direct SQL query with just P1A
    console.log("\n--- Test 4: Direct query WHERE LocCode = P1A ---");
    const directRows = await db.query<any>(`SELECT GangCode, Description, LocCode FROM HR_GANG WHERE RTRIM(LocCode) = ? ORDER BY GangCode`, ['P1A']);
    console.log(`  Result: ${directRows.length} gangs`);
    directRows.slice(0, 5).forEach(r => console.log(`    ${r.GangCode?.trim()} - ${r.LocCode?.trim()}`));

    // Test 5: Try AB1, AB2, etc
    console.log("\n--- Test 5: getGangsForDivision('AB1') ---");
    const ab1Gangs = await divisionConfigService.getGangsForDivision('AB1');
    console.log(`  Result: ${ab1Gangs.length} gangs`);

    // Test 6: What does the divisions API return?
    console.log("\n--- Test 6: getAllDivisionCodes ---");
    const divCodes = divisionConfigService.getAllDivisionCodes();
    console.log(`  Division codes: ${divCodes.join(', ')}`);

    // Test 7: Try fetching gangs for ALL divisions
    console.log("\n--- Test 7: Gangs per division ---");
    for (const div of divCodes) {
        try {
            const gangs = await divisionConfigService.getGangsForDivision(div);
            console.log(`  ${div}: ${gangs.length} gangs`);
        } catch (e: any) {
            console.log(`  ${div}: ERROR - ${e.message}`);
        }
    }

    console.log("\n=== DONE ===");
}

testGangLoading().catch(e => {
    console.error("Fatal error:", e);
    process.exit(1);
});
