import { divisionConfigService } from "../../src/services/config/DivisionConfigService";

async function main() {
    const division = "PG1A"; // Canonical for P1A
    console.log(`Checking gangs for division: ${division}`);
    
    try {
        const gangs = await divisionConfigService.getGangsForDivision(division);
        console.log(`Found ${gangs.length} gangs:`);
        console.table(gangs.slice(0, 10)); // Show first 10
        
        if (gangs.length > 0) {
            console.log("Sample gang:", gangs[0]);
        }
    } catch (e) {
        console.error("Error fetching gangs:", e);
    }
}

main().catch(console.error).finally(() => process.exit(0));
