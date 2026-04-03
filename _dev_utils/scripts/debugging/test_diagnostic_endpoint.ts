
import { Config } from "../config";

async function testEndpoint() {
    const gangCode = 'B2N';
    const month = 3;
    const year = 2026;
    
    const url = `http://localhost:3001/backend/upah/payroll/test/jabatan-thr-kontan?gang_code=${gangCode}&month=${month}&year=${year}`;
    
    console.log(`Calling test endpoint: ${url}`);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            console.error(await response.text());
            return;
        }
        
        const data = await response.json();
        console.log("Endpoint Result Summary:");
        console.log(`Conclusion: ${data.conclusion}`);
        console.log(`Message: ${data.message}`);
        
        console.log("\nStep 1: Employees");
        console.log(`Total: ${data.step1_employees.total}`);
        
        console.log("\nStep 2: Jabatan");
        console.log(`Table Total Records: ${data.step2_jabatan.table_total_records}`);
        console.log(`Records for Gang: ${data.step2_jabatan.records_for_gang}`);
        console.log(`Status: ${data.step2_jabatan.status}`);
        
        console.log("\nStep 3: THR");
        console.log(`DB Total: ${data.step3_thr.db_total_records}`);
        console.log(`Matched to Gang: ${data.step3_thr.matched_to_gang_employees}`);
        console.log(`Status: ${data.step3_thr.status}`);
        
        console.log("\nStep 4: KONTAN");
        console.log(`DB Total: ${data.step4_kontan.db_total_records}`);
        console.log(`Matched to Gang: ${data.step4_kontan.matched_to_gang_employees}`);
        console.log(`Status: ${data.step4_kontan.status}`);
        
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

testEndpoint();
