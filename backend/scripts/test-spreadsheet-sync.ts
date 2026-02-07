import { Config } from "../src/config";

const BASE_URL = "http://localhost:8002/backend/upah";

async function testSync() {
    console.log("Testing Spreadsheet Sync...");

    // 1. Login to get token
    console.log("Logging in as admin...");
    let token = "";
    try {
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "admin", password: "admin" })
        });

        if (!loginRes.ok) {
            console.error("Login Failed:", loginRes.status, await loginRes.text());
            return;
        }

        const loginData = await loginRes.json();
        token = loginData.access_token;
        console.log("Login Success. Token received.");

    } catch (e) {
        console.error("Login Exception:", e);
        return;
    }

    // 2. Trigger Sync
    console.log("Triggering Sync...");
    const payload = {
        division: "AB1",
        month: 1,
        year: 2026
    };

    try {
        const response = await fetch(`${BASE_URL}/spreadsheet/sync`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log("Response Status:", response.status);
        console.log("Response Data:", JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

testSync();
