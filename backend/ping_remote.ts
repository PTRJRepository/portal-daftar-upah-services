
import { fetch } from "bun";
console.log("Pinging 10.0.0.110:8001...");
try {
    const res = await fetch("http://10.0.0.110:8001/");
    console.log(`Root: ${res.status}`);
} catch (e) {
    console.log("Error:", e.message);
}
