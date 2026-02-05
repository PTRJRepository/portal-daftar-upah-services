
import { AuthService } from "../services/authService";
import { Config } from "../config";

async function main() {
    console.log("Authenticating as admin...");
    const authService = AuthService.getInstance();
    const user = await authService.authenticate("admin", "admin");
    const token = await authService.createToken(user!);
    console.log("Token obtained.");

    const url = `http://localhost:${Config.PORT}/backend/upah/payroll/aggregation/seed`;

    // Seed WKS_PG
    console.log(`Triggering seeding for WKS_PG...`);
    await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ division: "WKS_PG", month: 1, year: 2026, force: true })
    }).then(r => r.json()).then(console.log).catch(console.error);

    // Seed WKS_AR
    console.log(`Triggering seeding for WKS_AR...`);
    await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ division: "WKS_AR", month: 1, year: 2026, force: true })
    }).then(r => r.json()).then(console.log).catch(console.error);
}

main().catch(console.error);
