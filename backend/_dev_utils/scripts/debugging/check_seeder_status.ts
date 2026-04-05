// Check seeder progress
const BACKEND_URL = "http://localhost:8002";
const TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjE3LCJlbWFpbCI6ImFkbWluIiwibmFtZSI6IkFkbWluaXN0cmF0b3IiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3NzIwMzQ0NzAsImV4cCI6MTc3MjA2MzI3MH0.E1zYEO_tiHIquqkr8w-WZfE1mtBx3r0eDp2dmrURmkVDI33YxqoAuZ41z7IDlGcs4vF0ce38GHzfqoDI-L42BRbB-cKAQOwOV6xBYGPlq2mVygNII5YU0TSk18ZgLKnfo_r7DOlu8vupaU3Hj8qO06WvBcqsLkU6r_NYvstMr9EQRPKKV2fTjUNA94CPTmXC5qt9wBTF78qGKoAzjoEqGeUfgnQFFSESgtgP82dkLzZSvfVALAHuarEmnq-JlFsVrw1bDY9-ng4gOXFL4oJs1RkN9Ngpb8V6vvG2KTh6CD-Q4fc1tV-kIQ67jZpxryvkfJPbK3hvFdTxAo80E4cBw";

async function checkProgress() {
    const res = await fetch(`${BACKEND_URL}/payroll/aggregation/progress`, {
        headers: { "Authorization": `Bearer ${TOKEN}` }
    });
    
    const data = await res.json();
    const p = data.progress;
    
    console.log("\n" + "=".repeat(60));
    console.log("📊 SEEDER PROGRESS");
    console.log("=".repeat(60));
    
    if (!p.is_running) {
        console.log("⏸️  Seeder is NOT running");
        console.log(`📝 Last status: ${p.message}`);
    } else {
        console.log("🔄 Seeder is RUNNING");
        console.log(`📦 Batch: ${p.current_batch}/${p.total_batches}`);
        console.log(`🏢 Current Division: ${p.current_division || '-'}`);
        console.log(`✅ Divisions done: ${p.divisions_done}/${p.divisions_total}`);
        console.log(`💬 Message: ${p.message}`);
        console.log(`⏱️  Elapsed: ${data.elapsed_seconds}s (${(data.elapsed_seconds / 60).toFixed(1)} min)`);
    }
    
    console.log("=".repeat(60));
    console.log(`🕐 Last update: ${p.last_update ? new Date(p.last_update).toLocaleTimeString('id-ID') : 'Never'}`);
    console.log("=".repeat(60) + "\n");
}

checkProgress().catch(err => {
    console.error("❌ Error:", err.message);
    process.exit(1);
});
