/**
 * Test the actual /payroll/summary/all-divisions endpoint
 * This is what the WagesSummaryRebinmasPage uses
 */

async function testSummaryEndpoint() {
    const month = 3;
    const year = 2026;
    
    console.log("=== TESTING /payroll/summary/all-divisions ===\n");
    
    try {
        const response = await fetch(`http://localhost:8002/payroll/summary/all-divisions?month=${month}&year=${year}&include_virtual=true`);
        
        if (!response.ok) {
            console.error("HTTP Error:", response.status, response.statusText);
            const errorText = await response.text();
            console.error("Error body:", errorText);
            process.exit(1);
        }
        
        const data = await response.json();
        
        if (data.success) {
            console.log(`Success! Found ${data.count} divisions\n`);
            
            console.log("Division Totals:");
            console.log("=".repeat(80));
            console.log("Division".padEnd(12), "Employees".padStart(10), "HK".padStart(10), "Upah Bersih".padStart(20));
            console.log("=".repeat(80));
            
            for (const div of data.data) {
                if (div.is_grand_total || div.is_subtotal) continue;
                console.log(
                    div.division_code.padEnd(12),
                    div.total_employees.toString().padStart(10),
                    div.total_hk.toString().padStart(10),
                    (div.total_upah_bersih || div.total_manual || 0).toLocaleString('id-ID').padStart(20)
                );
            }
            
            console.log("=".repeat(80));
            
            if (data.grand_total) {
                console.log(
                    "GRAND TOTAL".padEnd(12),
                    data.grand_total.total_employees.toString().padStart(10),
                    data.grand_total.total_hk.toString().padStart(10),
                    (data.grand_total.total_upah_bersih || 0).toLocaleString('id-ID').padStart(20)
                );
            }
            
            // Find P1A specifically
            const p1a = data.data.find(d => d.division_code === 'P1A');
            if (p1a) {
                console.log("\n=== P1A DETAIL ===");
                console.log(`Division Code: ${p1a.division_code}`);
                console.log(`Description: ${p1a.description}`);
                console.log(`Total Employees: ${p1a.total_employees}`);
                console.log(`Total HK: ${p1a.total_hk}`);
                console.log(`Total Upah Bersih: ${(p1a.total_upah_bersih || 0).toLocaleString('id-ID')}`);
                console.log(`Total Manual: ${(p1a.total_manual || 0).toLocaleString('id-ID')}`);
                console.log(`Total Premi: ${(p1a.total_premi || 0).toLocaleString('id-ID')}`);
                console.log(`Total Lembur: ${(p1a.total_lembur || 0).toLocaleString('id-ID')}`);
            }
        } else {
            console.error("API returned success: false");
            console.error("Error:", data.error);
        }
    } catch (error: any) {
        console.error("Error:", error.message);
        console.error("Stack:", error.stack);
    }
    
    process.exit(0);
}

testSummaryEndpoint();
