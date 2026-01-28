import { gangService } from "./services/gangService";
import { writeFileSync } from "fs";

async function debug() {
    console.log("Fetching gangs for division: AB1");

    // Simulate what the API does
    const gangs = await gangService.fetchGangs('AB1');

    // Check if A1H is in the list
    const found = gangs.find(g => g.gang_code.trim() === 'A1H');

    const result = {
        found: !!found,
        gang: found,
        total_gangs: gangs.length,
        first_5_gangs: gangs.slice(0, 5)
    };

    writeFileSync("ab1_gangs_check.json", JSON.stringify(result, null, 2));
    process.exit(0);
}

debug().catch(console.error);
