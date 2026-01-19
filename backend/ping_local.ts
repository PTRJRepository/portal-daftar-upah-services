
import { fetch } from "bun";
console.log("Pinging localhost:8001...");
try {
    const res = await fetch("http://localhost:8001/v1/health");
    console.log(`Health: ${res.status}`);
    const res2 = await fetch("http://localhost:8001/health");
    console.log(`Health (root): ${res2.status}`);
} catch (e) {
    console.log("Error:", e.message);
}
