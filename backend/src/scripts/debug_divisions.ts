
import { Database } from "../db/client";
import { divisionDefinition } from "../services/divisionDefinition";

async function main() {
    const db = Database.getInstance();

    console.log("Checking Workshop Gangs...");

    const gangs = await db.query<any>(`
        SELECT GangCode, Description, LocCode 
        FROM HR_GANG 
        WHERE Description LIKE '%workshop%'
    `);

    console.log(`Found ${gangs.length} gangs with 'workshop' in description.`);

    const wksPg = await divisionDefinition.getGangsForDivision("WKS_PG");
    console.log(`\n[WKS_PG] Matched Gangs: ${wksPg.length}`);
    wksPg.forEach(g => console.log(` - ${g.gang_code} (${g.description}) [${g.source_loc_code}]`));

    const wksAr = await divisionDefinition.getGangsForDivision("WKS_AR");
    console.log(`\n[WKS_AR] Matched Gangs: ${wksAr.length}`);
    wksAr.forEach(g => console.log(` - ${g.gang_code} (${g.description}) [${g.source_loc_code}]`));

    const workshopAll = await divisionDefinition.getGangsForDivision("WORKSHOP");
    console.log(`\n[WORKSHOP] (Combined) Matched Gangs: ${workshopAll.length}`);

    // Check for gangs in WORKSHOP but not in PG or AR
    const pgArCodes = new Set([...wksPg, ...wksAr].map(g => g.gang_code));
    const missing = workshopAll.filter(g => !pgArCodes.has(g.gang_code));

    if (missing.length > 0) {
        console.log("\n[WARNING] The following gangs are in WORKSHOP but NOT in WKS_PG or WKS_AR:");
        missing.forEach(g => console.log(` - ${g.gang_code} (${g.description})`));
    } else {
        console.log("\n[OK] All WORKSHOP gangs are covered by WKS_PG and WKS_AR.");
    }
}

main().catch(console.error);
