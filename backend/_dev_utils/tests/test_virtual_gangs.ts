import { divisionConfigService } from "../../src/services/config/DivisionConfigService";

async function main() {
    console.log("=== Testing WKS_AR gangs ===\n");
    const gangs = await divisionConfigService.getGangsForDivision('WKS_AR');
    console.log(`WKS_AR gangs: ${gangs.length}`);
    gangs.forEach(g => {
        console.log(`  ${g.gang_code} | ${g.loc_code} | ${g.description}`);
    });
    
    console.log("\n=== Testing INF gangs ===\n");
    const infGangs = await divisionConfigService.getGangsForDivision('INF');
    console.log(`INF gangs: ${infGangs.length}`);
    infGangs.forEach(g => {
        console.log(`  ${g.gang_code} | ${g.loc_code} | ${g.description}`);
    });
}

main().catch(console.error);
