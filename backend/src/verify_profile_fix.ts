
import { gangService } from "./services/gangService";

async function verify() {
    console.log("Verifying Gang Retrieval...");
    try {
        const gangs = await gangService.fetchGangs("ALL"); // Should return all gangs from profile 2
        console.log(`Fetched ${gangs.length} gangs.`);
        if (gangs.length > 0) {
            console.log("First 3 gangs:", gangs.slice(0, 3));
        } else {
            console.error("Still fetching 0 gangs!");
        }

        // Test specific division aggregation source
        const p1a_gangs = await gangService.fetchGangs("PG1A");
        console.log(`Fetched ${p1a_gangs.length} gangs for PG1A.`);

    } catch (e) {
        console.error("Verification Error:", e);
    }
    process.exit(0);
}

verify().catch(console.error);
