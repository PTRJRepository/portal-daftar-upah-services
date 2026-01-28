const BASE_URL = "http://localhost:8002";

async function runVerification() {
    console.log("🔍 Starting Backend Verification...");

    // 1. Health Check
    try {
        const health = await fetch(`${BASE_URL}/health`);
        const healthData = await health.json();
        console.log("✅ Health Check:", health.status, healthData);
    } catch (e) {
        console.error("❌ Health Check Failed:", e);
        return;
    }

    // 2. Login
    let token = "";
    try {
        const login = await fetch(`${BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "admin", password: "admin" })
        });

        if (login.status !== 200) {
            console.error("❌ Login Failed:", login.status, await login.text());
            return;
        }

        const loginData: any = await login.json();
        console.log("✅ Login Success, Token received.");
        token = loginData.access_token;
    } catch (e) {
        console.error("❌ Login Exception:", e);
        return;
    }

    // 3.5 Access Check (Summary)
    console.log("👉 Checking /payroll/summary/access-check...");
    try {
        const access = await fetch(`${BASE_URL}/payroll/summary/access-check`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        console.log("✅ Access Check:", access.status, await access.json());
    } catch (e) {
        console.error("❌ Access Check Failed:", e);
    }

    // 3.7 Check Periods (New Summary Endpoint)
    console.log("👉 Checking /payroll/summary/periods...");
    try {
        const periods = await fetch(`${BASE_URL}/payroll/summary/periods`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (periods.status === 200) {
             const data = await periods.json();
             console.log("✅ Periods Check:", data);
        } else {
             console.error("❌ Periods Check Failed:", periods.status, await periods.text());
        }
    } catch (e) {
        console.error("❌ Periods Check Exception:", e);
    }

    // 3.6 Check Divisions (DB Test)
    console.log("👉 Checking /payroll/divisions (DB Test)...");
    try {
        const divisions = await fetch(`${BASE_URL}/payroll/divisions`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (divisions.status === 200) {
             const divData: any = await divisions.json();
             console.log("✅ Divisions Check (DB): OK, Count:", Array.isArray(divData) ? divData.length : 'Unknown');
        } else {
             console.error("❌ Divisions Check Failed:", divisions.status, await divisions.text());
        }
    } catch (e) {
        console.error("❌ Divisions Check Exception:", e);
    }
}

runVerification();
