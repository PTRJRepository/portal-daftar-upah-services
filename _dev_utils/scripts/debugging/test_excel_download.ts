/**
 * Test Tax Report Excel Download
 * Run: cd backend && bun run src/scripts/test_excel_download.ts
 */

const BASE_URL = 'http://localhost:8002';

async function testExcelDownload() {
    console.log('='.repeat(60));
    console.log('[TEST] Testing Tax Report Excel Download');
    console.log('='.repeat(60));

    // Step 1: Login to get token
    console.log('\n[1] Logging in...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.access_token;
    console.log(`    Token: ${token?.substring(0, 20)}...`);

    if (!token) {
        console.log('    ❌ Login failed');
        return;
    }

    // Step 2: Try the monthly data endpoint first (JSON)
    console.log('\n[2] Testing /tax-report/monthly (JSON)...');
    try {
        const monthlyRes = await fetch(`${BASE_URL}/tax-report/monthly?year=2026&month=3&division=AB1`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const monthlyData = await monthlyRes.json();
        console.log(`    Status: ${monthlyRes.status}`);
        console.log(`    Employees: ${monthlyData.employees?.length || 0}`);
        console.log(`    Total PPh21: ${monthlyData.total_pph21}`);
    } catch (e: any) {
        console.log(`    ERROR: ${e.message}`);
    }

    // Step 3: Try the Excel download endpoint
    console.log('\n[3] Testing /tax-report/monthly/excel (Binary)...');
    try {
        const excelRes = await fetch(`${BASE_URL}/tax-report/monthly/excel?year=2026&month=3&division=AB1`, {
            headers: { 
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        });
        
        console.log(`    Status: ${excelRes.status}`);
        console.log(`    Status Text: ${excelRes.statusText}`);
        console.log(`    Content-Type: ${excelRes.headers.get('content-type')}`);
        console.log(`    Content-Length: ${excelRes.headers.get('content-length')}`);
        
        const buffer = await excelRes.arrayBuffer();
        console.log(`    Data Length: ${buffer.byteLength}`);
        
        if (buffer.byteLength > 0) {
            console.log('\n    ✅ SUCCESS! File downloaded.');
            const fs = await import('fs');
            fs.writeFileSync('test_output.xlsx', Buffer.from(buffer));
            console.log('    Saved to test_output.xlsx');
        } else {
            console.log('\n    ❌ FAILED: Empty response');
            const text = await excelRes.text();
            console.log(`    Response text: ${text.substring(0, 500)}`);
        }
    } catch (e: any) {
        console.log(`    ERROR: ${e.message}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('[TEST] Complete');
    console.log('='.repeat(60));
}

testExcelDownload().catch(console.error);