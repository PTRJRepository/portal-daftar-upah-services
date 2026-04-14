import { divisionConfigService } from "../../backend/src/services/config/DivisionConfigService";

async function test() {
    console.log("Testing Enhanced Gang Discovery for PG1A (Group 1)...");
    
    const gangs = await divisionConfigService.getGangsForDivision("PG1A");
    console.log(`\nFound ${gangs.length} unique gangs for PG1A:`);
    
    const araGangs = gangs.filter(g => g.loc_code === 'ARA' || g.description.includes('ARA'));
    const bhlGangs = gangs.filter(g => g.description.includes('BHL'));
    
    console.log(`\n--- ARA related gangs in PG1A (${araGangs.length} total) ---`);
    araGangs.forEach(g => console.log(`  - [${g.gang_code}] ${g.description} (Loc: ${g.loc_code})`));
    
    console.log(`\n--- BHL related gangs in PG1A (${bhlGangs.length} total) ---`);
    bhlGangs.forEach(g => console.log(`  - [${g.gang_code}] ${g.description} (Loc: ${g.loc_code})`));
}

test().catch(console.error);
