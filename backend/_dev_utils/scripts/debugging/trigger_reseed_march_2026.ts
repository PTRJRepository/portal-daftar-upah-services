// Trigger aggregation re-seeding for March 2026
const BACKEND_URL = "http://localhost:8002";

// Token dari login.json (admin)
const TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjE3LCJlbWFpbCI6ImFkbWluIiwibmFtZSI6IkFkbWluaXN0cmF0b3IiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3NzIwMzQ0NzAsImV4cCI6MTc3MjA2MzI3MH0.E1zYEO_tiHIquqkr8w-WZfE1mtBx3r0eDp2dmrURmkVDI33YxqoAuZ41z7IDlGcs4vF0ce38GHzfqoDI-L42BRbB-cKAQOwOV6xBYGPlq2mVygNII5YU0TSk18ZgLKnfo_r7DOlu8vupaU3Hj8qO06WvBcqsLkU6r_NYvstMr9EQRPKKV2fTjUNA94CPTmXC5qt9wBTF78qGKoAzjoEqGeUfgnQFFSESgtgP82dkLzZSvfVALAHuarEmnq-JlFsVrw1bDY9-ng4gOXFL4oJs1RkN9Ngpb8V6vvG2KTh6CD-Q4fc1tV-kIQ67jZpxryvkfJPbK3hvFdTxAo80E4cBw";

async function triggerSeed(token: string) {
    console.log("🚀 Triggering aggregation seeding for March 2026...\n");
    console.log("⏳ This may take a while. Check backend logs for progress.\n");
    
    const res = await fetch(`${BACKEND_URL}/payroll/aggregation/seed`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
            month: 3,
            year: 2026,
            force: true
        })
    });
    
    const text = await res.text();
    console.log("Raw response:", text.substring(0, 500));
    
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        console.error("Failed to parse JSON. Response:", text);
        return;
    }
    
    console.log("\nResponse:", JSON.stringify(data, null, 2));

    if (data.success) {
        console.log("\n✅ Seeding triggered successfully!");
        console.log(`Divisions processed: ${data.result?.total_divisions || '?'}`);
    } else {
        console.log("\n❌ Seeding failed:", data.error || data.message);
    }
}

async function main() {
    try {
        await triggerSeed(TOKEN);
    } catch (error: any) {
        console.error("❌ Error:", error.message);
    }
}

main();
