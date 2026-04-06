/**
 * Test the actual /recap-all endpoint
 */

async function testRecapAll() {
    const month = 3;
    const year = 2026;
    
    console.log("=== TESTING /recap-all ENDPOINT ===\n");
    
    try {
        const response = await fetch(`http://localhost:8002/payroll/wages/recap-all/${month}/${year}`, {
            headers: {
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiYWRtaW4iLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzQzOTI0MDUwLCJleHAiOjE3NDM5Mjc2NTB9.xYz123' // Placeholder - will fail auth but let's see the structure
            }
        });
        
        const data = await response.json();
        console.log("Response status:", response.status);
        console.log("Response:", JSON.stringify(data, null, 2));
        
        if (data.success && data.divisions) {
            console.log("\n--- Division Totals ---");
            data.divisions.forEach((div: any) => {
                console.log(`${div.division.padEnd(12)} | emp=${div.karyawan_count.toString().padStart(5)} | upah=${div.total_upah_bersih.toLocaleString('id-ID')}`);
            });
            
            console.log("\n--- Grand Total ---");
            console.log(`emp=${data.grand_total.total_karyawan} | upah=${data.grand_total.total_upah_bersih.toLocaleString('id-ID')}`);
        }
    } catch (error: any) {
        console.error("Error:", error.message);
    }
    
    process.exit(0);
}

testRecapAll();
