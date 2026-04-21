/**
 * Simulate exact frontend API call via proxy path
 */

import axios from 'axios';

async function testFrontendCall() {
    console.log('='.repeat(80));
    console.log('TESTING FRONTEND-STYLE API CALL');
    console.log('='.repeat(80));

    // You need to provide a token
    const token = process.env.TEST_TOKEN;
    
    if (!token) {
        console.log('\n⚠️  Please get your auth token from browser:');
        console.log('1. Open DevTools → Application → Local Storage');
        console.log('2. Find your auth token');
        console.log('3. Run: TEST_TOKEN=<token> bun run test_frontend_call.ts');
        return;
    }

    // Test via backend directly (port 8002)
    console.log('\n[TEST 1] Direct backend call (localhost:8002)...');
    try {
        const response1 = await axios.get('http://localhost:8002/tax-report/monthly', {
            params: {
                year: 2026,
                month: 3,
                division: 'PG2A'
            },
            headers: {
                'Authorization': `Bearer ${token}`
            },
            timeout: 120000
        });

        console.log(`✅ Response: ${response1.data.employees?.length || 0} employees`);
        console.log(`   Data Source: ${response1.data.data_source}`);
        console.log(`   Total PPH21: ${response1.data.total_pph21}`);
    } catch (error: any) {
        console.log(`❌ Error: ${error.message}`);
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Data: ${JSON.stringify(error.response.data)}`);
        }
    }

    // Test via proxy path (like frontend does)
    console.log('\n[TEST 2] Proxy path call (/backend/upah/tax-report/monthly)...');
    try {
        const response2 = await axios.get('http://localhost:8002/backend/upah/tax-report/monthly', {
            params: {
                year: 2026,
                month: 3,
                division: 'PG2A'
            },
            headers: {
                'Authorization': `Bearer ${token}`
            },
            timeout: 120000
        });

        console.log(`✅ Response: ${response2.data.employees?.length || 0} employees`);
        console.log(`   Data Source: ${response2.data.data_source}`);
        console.log(`   Total PPH21: ${response2.data.total_pph21}`);
    } catch (error: any) {
        console.log(`❌ Error: ${error.message}`);
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Data: ${JSON.stringify(error.response.data)}`);
        }
    }

    console.log('\n' + '='.repeat(80));
}

testFrontendCall()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
