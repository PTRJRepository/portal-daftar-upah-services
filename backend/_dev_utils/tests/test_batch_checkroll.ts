/**
 * Test script for batch checkroll API
 * Usage: bun run _dev_utils/tests/test_batch_checkroll.ts
 */
async function testBatchCheckroll() {
    const baseURL = 'http://localhost:8002';
    const token = 'dev-bypass-token-12345'; // Use a bypass token or a real one if needed
    const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    // Sample employees (adjust based on your local DB)
    const empCodes = ['F0317', 'J0843']; 
    const month = 3;
    const year = 2026;

    console.log(`=== TESTING BATCH CHECKROLL API ===`);
    console.log(`URL: ${baseURL}/payroll/employee/batch-checkroll`);
    console.log(`Payload: ${JSON.stringify({ emp_codes: empCodes, month, year })}\n`);

    const startTime = Date.now();
    try {
        const response = await fetch(`${baseURL}/payroll/employee/batch-checkroll`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                emp_codes: empCodes,
                month,
                year
            })
        });

        const duration = Date.now() - startTime;
        console.log(`Status: ${response.status} (${response.statusText})`);
        console.log(`Execution Time: ${duration}ms`);

        const result = await response.json();
        
        if (response.ok) {
            console.log(`Success: ${result.success}`);
            console.log(`Data Count: ${result.data?.length || 0}`);
            
            if (result.data && result.data.length > 0) {
                console.log("\nSample Data (First Employee):");
                const first = result.data[0];
                console.log(`- EmpCode: ${first.emp_code}`);
                console.log(`- Nama: ${first.employee?.nama}`);
                console.log(`- Upah Bersih: ${first.payroll_data?.upah_bersih}`);
                console.log(`- Debug Source: ${first.debug_info?.source}`);
            }

            if (result.not_found && result.not_found.length > 0) {
                console.log("\nNot Found:");
                console.table(result.not_found);
            }

            if (result.errors && result.errors.length > 0) {
                console.log("\nErrors:");
                console.table(result.errors);
            }

            console.log("\nMeta:");
            console.table(result.meta);

        } else {
            console.error("API Error Response:", JSON.stringify(result, null, 2));
        }

    } catch (error: any) {
        console.error("Fetch Error:", error.message);
    }
}

testBatchCheckroll().catch(console.error);
