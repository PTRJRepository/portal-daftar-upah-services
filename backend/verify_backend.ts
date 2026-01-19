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

    // 4. Test Report Generation (New)
    console.log("👉 Testing Report Generation...");
    try {
        const report = await fetch(`${BASE_URL}/reports/generate`, {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                month: 5,
                year: 2025,
                gang_code: "H1H"
            })
        });

        if (report.status === 200) {
            const reportData: any = await report.json();
            console.log("✅ Report Generation Started:", reportData);
            
            // Poll for status (optional check)
            const jobId = reportData.job_id;
            console.log(`Checking job status for ${jobId}...`);
            const jobStatus = await fetch(`${BASE_URL}/reports/${jobId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            console.log("Job Status Response:", await jobStatus.json());
        } else {
            console.error("❌ Report Generation Failed:", report.status, await report.text());
        }

    } catch (e) {
        console.error("❌ Report Verification Failed:", e);
    }
}

runVerification();