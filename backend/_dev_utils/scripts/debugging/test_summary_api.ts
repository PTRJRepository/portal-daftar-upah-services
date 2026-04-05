// Test summary API response for March 2026
const BACKEND_URL = "http://localhost:8002";
const TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjE3LCJlbWFpbCI6ImFkbWluIiwibmFtZSI6IkFkbWluaXN0cmF0b3IiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3NzIwMzQ0NzAsImV4cCI6MTc3MjA2MzI3MH0.E1zYEO_tiHIquqkr8w-WZfE1mtBx3r0eDp2dmrURmkVDI33YxqoAuZ41z7IDlGcs4vF0ce38GHzfqoDI-L42BRbB-cKAQOwOV6xBYGPlq2mVygNII5YU0TSk18ZgLKnfo_r7DOlu8vupaU3Hj8qO06WvBcqsLkU6r_NYvstMr9EQRPKKV2fTjUNA94CPTmXC5qt9wBTF78qGKoAzjoEqGeUfgnQFFSESgtgP82dkLzZSvfVALAHuarEmnq-JlFsVrw1bDY9-ng4gOXFL4oJs1RkN9Ngpb8V6vvG2KTh6CD-Q4fc1tV-kIQ67jZpxryvkfJPbK3hvFdTxAo80E4cBw";

async function main() {
    console.log("📊 Fetching summary for March 2026...\n");
    
    const url = `${BACKEND_URL}/payroll/summary/division?month=3&year=2026`;
    const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${TOKEN}` }
    });
    
    const text = await res.text();
    
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        console.error("Failed to parse JSON");
        console.log("Raw response (first 500 chars):", text.substring(0, 500));
        return;
    }
    
    if (data.divisions && data.divisions.length > 0) {
        console.log(`Found ${data.divisions.length} divisions\n`);
        
        let totalPph21 = 0;
        for (const div of data.divisions) {
            const pph21 = div.total_pph21 || 0;
            totalPph21 += pph21;
            console.log(`${div.division_code}: PPh21 = ${pph21.toLocaleString('id-ID')}`);
        }
        
        console.log(`\n=== TOTAL PPh21 from summary API: ${totalPph21.toLocaleString('id-ID')} ===`);
    } else {
        console.log("No divisions found!");
        console.log("Full response:", JSON.stringify(data, null, 2).substring(0, 1000));
    }
}

main().catch(console.error);
