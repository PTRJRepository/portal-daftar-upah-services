/**
 * Quick script to trigger parallel aggregation seeding
 * Run AFTER backend restart: bun run _dev_utils/scripts/debugging/trigger_parallel_seed.ts
 */

const BACKEND_URL = "http://localhost:8002";
const TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjE3LCJlbWFpbCI6ImFkbWluIiwibmFtZSI6IkFkbWluaXN0cmF0b3IiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3NzIwMzQ0NzAsImV4cCI6MTc3MjA2MzI3MH0.E1zYEO_tiHIquqkr8w-WZfE1mtBx3r0eDp2dmrURmkVDI33YxqoAuZ41z7IDlGcs4vF0ce38GHzfqoDI-L42BRbB-cKAQOwOV6xBYGPlq2mVygNII5YU0TSk18ZgLKnfo_r7DOlu8vupaU3Hj8qO06WvBcqsLkU6r_NYvstMr9EQRPKKV2fTjUNA94CPTmXC5qt9wBTF78qGKoAzjoEqGeUfgnQFFSESgtgP82dkLzZSvfVALAHuarEmnq-JlFsVrw1bDY9-ng4gOXFL4oJs1RkN9Ngpb8V6vvG2KTh6CD-Q4fc1tV-kIQ67jZpxryvkfJPbK3hvFdTxAo80E4cBw";

async function main() {
    console.log("🚀 Triggering PARALLEL aggregation seeding for March 2026...\n");
    console.log("⏳ This will take ~5-10 minutes (vs 30-45 min sequential)");
    console.log("📊 Check backend logs for progress\n");
    
    const startTime = Date.now();
    
    const res = await fetch(`${BACKEND_URL}/payroll/aggregation/seed`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${TOKEN}`
        },
        body: JSON.stringify({
            month: 3,
            year: 2026,
            force: true,
            useParallel: true  // Enable parallel processing
        })
    });
    
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        console.error("Failed to parse response");
        console.log("Raw:", text.substring(0, 500));
        return;
    }
    
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    if (data.success) {
        console.log("\n✅ Seeding completed successfully!");
        console.log(`⏱️  Time: ${elapsed} minutes`);
        console.log(`📊 Divisions processed: ${data.data?.total_divisions || '?'}`);
        console.log("\n📋 Results:");
        data.data?.processed?.forEach((r: any) => {
            const icon = r.status === 'SUCCESS' ? '✅' : '❌';
            console.log(`  ${icon} ${r.division}: ${r.status} (${r.employees_processed} emp, ${r.time_seconds || '?'}s)`);
        });
    } else {
        console.log("\n❌ Seeding failed:", data.error || data.message);
    }
}

main().catch(err => {
    console.error("❌ Error:", err.message);
    process.exit(1);
});
