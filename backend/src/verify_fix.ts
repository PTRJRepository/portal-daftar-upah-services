
import { currentPeriodService } from "./services/currentPeriodService";
import { Database } from "./db/client";

async function verify() {
    console.log("Verifying Current Period Service after fix...");

    try {
        // Test getCurrentPeriod
        const period = await currentPeriodService.getCurrentPeriod();
        console.log("Current Period Result:", period);
    } catch (e) {
        console.error("Error calling getCurrentPeriod:", e);
    }

    process.exit(0);
}

verify().catch(console.error);
