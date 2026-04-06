/**
 * Test exact API call that frontend makes for PG2A Maret 2026
 */

import axios from 'axios';

async function testApiCall() {
    console.log('='.repeat(80));
    console.log('TESTING FRONTEND API CALL FOR PG2A - MARET 2026');
    console.log('='.repeat(80));

    // You need to provide your auth token
    const token = process.env.TEST_TOKEN || 'your-token-here';

    if (!token || token === 'your-token-here') {
        console.log('\n⚠️  Please provide your auth token:');
        console.log('1. Open browser DevTools (F12) → Application → Local Storage');
        console.log('2. Find your auth token key');
        console.log('3. Run: TEST_TOKEN=<token> bun run test_pg2a_api.ts');
        return;
    }

    const baseUrl = 'http://localhost:8002'; // Backend port
    const endpoint = '/tax-report/monthly';
    
    const params = {
        year: 2026,
        month: 3,
        division: 'PG2A'
    };

    console.log('\nMaking API call...');
    console.log(`URL: ${baseUrl}${endpoint}`);
    console.log(`Params: ${JSON.stringify(params, null, 2)}`);

    try {
        const response = await axios.get(`${baseUrl}${endpoint}`, {
            params,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            timeout: 120000
        });

        const data = response.data;
        
        console.log('\n✅ Response received:');
        console.log(`  Data Source: ${data.data_source}`);
        console.log(`  Total Employees: ${data.employees?.length || 0}`);
        console.log(`  Total PPH21: ${data.total_pph21}`);
        
        if (data.employees?.length > 0) {
            console.log(`\n  First 3 employees:`);
            data.employees.slice(0, 3).forEach((emp: any, idx: number) => {
                console.log(`    ${idx + 1}. ${emp.emp_name || emp.emp_code} - PPH21: ${emp.pph21_ter || emp.pph21_bulanan || 0}`);
            });
        }
        
    } catch (error: any) {
        console.log(`\n❌ API call failed: ${error.message}`);
        if (error.response) {
            console.log(`  Status: ${error.response.status}`);
            console.log(`  Data: ${JSON.stringify(error.response.data)}`);
        }
    }

    console.log('\n' + '='.repeat(80));
}

testApiCall()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
