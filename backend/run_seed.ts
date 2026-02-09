
import { SignJWT } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "default_debug_secret";
const API_URL = "http://localhost:8002/payroll/aggregation/seed";

async function generateToken() {
    const secret = new TextEncoder().encode(JWT_SECRET);
    return await new SignJWT({ sub: "admin", role: "admin" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(secret);
}

async function triggerSeed(month: number, year: number) {
    const token = await generateToken();
    console.log(`Triggering seed for ${month}/${year}...`);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                month,
                year,
                force: true
            })
        });

        const result = await response.json();
        console.log(`Response status: ${response.status}`);
        console.log("Result:", JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("Error triggering seed:", error);
    }
}

// Run for Jan 2025
await triggerSeed(1, 2025);
