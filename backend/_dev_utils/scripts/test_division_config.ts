import { divisionConfigService } from "../../src/services/config/DivisionConfigService";
import { Database } from "../../src/db/client";

async function main() {
    console.log("Testing getGangsForDivision('DME')...");
    const dmeGangs = await divisionConfigService.getGangsForDivision("DME");
    console.log(`Found ${dmeGangs.length} gangs for DME`);
    console.log(JSON.stringify(dmeGangs, null, 2));

    console.log("\nTesting getGangsForDivision('IJL')...");
    const ijlGangs = await divisionConfigService.getGangsForDivision("IJL");
    console.log(`Found ${ijlGangs.length} gangs for IJL`);
    console.log(JSON.stringify(ijlGangs, null, 2));
}

main().catch(console.error);
