import { Database } from "./src/db/client";
import { employeeDetailService } from "./src/services/employeeDetailService";

async function main() {
    try {
        console.log("Testing detail service for B0079...");
        const result = await employeeDetailService.getEmployeeCheckroll("B0079", 3, 2026, true);
        console.log("SUCCESS:");
        console.log(JSON.stringify(result, null, 2).substring(0, 500) + "...");
    } catch (e) {
        console.error("ERROR:");
        console.error(e);
    }
    process.exit(0);
}
main();
