// Monitor seeding progress
const BACKEND_URL = "http://localhost:8002";
const TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjE3LCJlbWFpbCI6ImFkbWluIiwibmFtZSI6IkFkbWluaXN0cmF0b3IiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3NzIwMzQ0NzAsImV4cCI6MTc3MjA2MzI3MH0.E1zYEO_tiHIquqkr8w-WZfE1mtBx3r0eDp2dmrURmkVDI33YxqoAuZ41z7IDlGcs4vF0ce38GHzfqoDI-L42BRbB-cKAQOwOV6xBYGPlq2mVygNII5YU0TSk18ZgLKnfo_r7DOlu8vupaU3Hj8qO06WvBcqsLkU6r_NYvstMr9EQRPKKV2fTjUNA94CPTmXC5qt9wBTF78qGKoAzjoEqGeUfgnQFFSESgtgP82dkLzZSvfVALAHuarEmnq-JlFsVrw1bDY9-ng4gOXFL4oJs1RkN9Ngpb8V6vvG2KTh6CD-Q4fc1tV-kIQ67jZpxryvkfJPbK3hvFdTxAo80E4cBw";

async function checkSeedingStatus() {
    const res = await fetch(`${BACKEND_URL}/payroll/aggregation/progress`, {
        headers: { "Authorization": `Bearer ${TOKEN}` }
    });
    
    const data = await res.json();
    console.log("Seeding progress:", JSON.stringify(data, null, 2));
    
    if (data.progress) {
        const p = data.progress;
        console.log(`\nStatus: ${p.current_step}`);
        console.log(`Running: ${p.is_running}`);
        console.log(`Division: ${p.current_division || '-'}`);
        console.log(`Gang: ${p.current_gang || '-'}`);
        console.log(`Gangs: ${p.gangs_done}/${p.gangs_total}`);
        console.log(`Employees: ${p.employees_processed}`);
    }
}

checkSeedingStatus().catch(console.error);
