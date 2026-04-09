import { divisionConfigService } from "../../src/services/config/DivisionConfigService";

async function main() {
    console.log("=== Testing PG1A gangs ===\n");
    const gangs = await divisionConfigService.getGangsForDivision('PG1A');
    console.log(`PG1A gangs: ${gangs.length}`);
    gangs.forEach(g => {
        console.log(`  ${g.gang_code} | ${g.loc_code} | ${g.description}`);
    });
}

main().catch(console.error);
