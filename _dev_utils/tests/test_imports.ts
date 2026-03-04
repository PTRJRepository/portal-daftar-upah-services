
import { payrollComponentRegistry } from "../../backend/src/services/payroll";
import { dataExtractorService } from "../../backend/src/services/dataExtractorService";

async function run() {
    try {
        console.log("Testing imports...");
        console.log("Registered components:", payrollComponentRegistry.getRegisteredComponents());
        console.log("Import success!");
    } catch (e) {
        console.error("Import failed with error:");
        console.error(e);
    }
}

run();
