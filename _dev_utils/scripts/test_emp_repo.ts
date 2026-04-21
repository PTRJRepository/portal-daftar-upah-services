import { Database } from "./src/db/client";
import { employeeRepository } from "./src/services/employeeRepository";

console.log("Testing employeeRepository.list...");
try {
    const result = await employeeRepository.list({ limit: 3 });
    console.log("Count:", result.length);
    if (result.length > 0) {
        console.log("First:", JSON.stringify(result[0], null, 2));
    } else {
        console.log("No results returned!");
    }
} catch (e) {
    console.error("Error:", e);
}
