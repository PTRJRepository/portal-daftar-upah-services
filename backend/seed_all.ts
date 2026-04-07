import { HistorySeederService } from "./src/services/historySeederService";
import { DatabaseService } from "./src/services/databaseService";

async function run() {
    console.log("Connecting DB...");
    await DatabaseService.getInstance().connect();
    
    console.log("Seeding ALL IJL (including PG2B)...");
    try {
        const seeder = HistorySeederService.getInstance();
        const result = await seeder.seedUiData(3, 2026, "IJL", null, null);
        console.log(`Success! Seeded ${result.total_employees} employees across ${result.total_gangs} gangs.`);
    } catch (e) {
        console.error("ERROR SEEDING:");
        console.error(e);
    }
    process.exit(0);
}

run();
