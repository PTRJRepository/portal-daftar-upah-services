
import { AuthService } from "../services/authService";
import { Config } from "../config";

async function main() {
    console.log("Authenticating as admin...");
    const authService = AuthService.getInstance();
    const user = await authService.authenticate("admin", "admin");

    if (!user) {
        console.error("Authentication failed.");
        process.exit(1);
    }

    const token = await authService.createToken(user);
    console.log("Token obtained.");

    const url = `http://localhost:8002/payroll/aggregation/seed`;
    console.log(`Triggering seeding for MILL...`);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                division: "MILL",
                month: 1,
                year: 2026,
                force: true
            })
        });

        const result = await response.json();
        console.log("Seeder Response:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

main().catch(console.error);
