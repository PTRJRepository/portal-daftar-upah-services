import { divisionConfigService } from "../../src/services/config/DivisionConfigService";

async function main() {
    console.log("=== Testing ARA gangs after fix ===\n");
    const gangs = await divisionConfigService.getGangsForDivision('ARA');
    console.log(`ARA gangs: ${gangs.length}`);
    gangs.forEach(g => {
        console.log(`  ${g.gang_code} | ${g.loc_code} | ${g.description}`);
    });
}

main().catch(console.error);
