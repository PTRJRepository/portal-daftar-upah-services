import { Config } from "../src/config";

const BASE_URL = "http://localhost:8002/backend/upah";

async function testRawTree() {
    console.log("Testing Raw Tree Endpoint...");

    // 1. Login
    console.log("Logging in...");
    let token = "";
    try {
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "admin", password: "admin" })
        });
        if (!loginRes.ok) throw new Error("Login failed");
        const loginData = await loginRes.json();
        token = loginData.access_token;
        console.log("Login Success.");
    } catch (e) {
        console.error("Login Error:", e);
        return;
    }

    // 2. Fetch Raw Tree
    const url = `${BASE_URL}/payroll/locked/report/raw-tree?div=AB1&month=1&year=2026`;
    console.log(`Fetching: ${url}`);

    try {
        const res = await fetch(url, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        console.log(`Status: ${res.status} ${res.statusText}`);
        if (!res.ok) {
            console.log("Error Body:", await res.text());
        } else {
            const json = await res.json();
            console.log("Response:", JSON.stringify(json, null, 2));
            if (json.data_rows) {
                console.log(`Data Rows Count: ${json.data_rows.length}`);
            } else {
                console.log("No data_rows found in response");
                console.log("Keys:", Object.keys(json));
            }
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

testRawTree();
