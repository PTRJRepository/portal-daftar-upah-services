const BACKEND_URL = 'http://localhost:8002';
const SYSTEM_TOKEN = 'system-internal-secret-token';

async function verify() {
    const month = "3";
    const year = "2026";
    const div = "ARA";

    console.log(`Verifying ARA Tax Report for ${month}/${year}...`);

    try {
        const headers = {
            'Authorization': `Bearer ${SYSTEM_TOKEN}`
        };

        const taxUrl = `${BACKEND_URL}/payroll/export/pajak?div=${div}&month=${month}&year=${year}`;
        console.log(`Fetching Tax JSON: ${taxUrl}`);
        const response = await fetch(taxUrl, { headers });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();
        const employeesMap = result.employees || {};
        const employeeList = Object.values(employeesMap);

        console.log(`\nResults:`);
        console.log(`Total Employees: ${employeeList.length}`);
        console.log(`Grand Total PPh21 TER: ${result.total_pph21_ter.toLocaleString()}`);

        // The user said the wrong total was 22,284,463
        // The correct total should be around 10,544,345
        if (result.total_pph21_ter > 15000000) {
            console.error("\n❌ FAILED: Total is still high. Duplication might still be present.");
        } else if (result.total_pph21_ter < 5000000) {
            console.error("\n❌ FAILED: Total is too low. Under-counting might be present.");
        } else {
            console.log("\n✅ SUCCESS: Grand total is in the expected range (approx 10.5M)!");
        }

        // Check for duplicates in the raw list if it were an array
        // (The API returns a Map keyed by emp_code, so internal JSON de-duplication already happens there, 
        // but the SERVICE'S total_pph21_ter needs to be accurate)
        
    } catch (e: any) {
        console.error("Verification failed:", e.message);
    }
}

verify().catch(console.error);
