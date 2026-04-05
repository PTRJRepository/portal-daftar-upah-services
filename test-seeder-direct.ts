/**
 * Test Seeder via Backend Direct (No Frontend Needed)
 * 
 * Cara pakai:
 * 1. Login ke port 3001 dulu
 * 2. Copy auth-token dari localStorage browser
 * 3. Jalankan script ini dengan token tersebut
 * 
 * Usage:
 * bun run test-seeder-direct.ts YOUR_AUTH_TOKEN_HERE
 */

const BASE_URL = 'http://localhost:8002';

// Get token from command line or prompt
const authToken = process.argv[2];

if (!authToken) {
    console.log('=== TEST SEEDER DIRECT ===\n');
    console.log('❌ Token tidak diberikan!\n');
    console.log('📋 Cara mendapatkan token:');
    console.log('1. Login ke aplikasi payroll di browser');
    console.log('2. Buka Developer Console (F12)');
    console.log('3. Run: localStorage.getItem("auth-token")');
    console.log('4. Copy token yang muncul');
    console.log('5. Jalankan script ini: bun run test-seeder-direct.ts <TOKEN>\n');
    console.log('💡 Atau, Anda bisa hardcode token di file ini (baris 17)\n');
    process.exit(1);
}

async function testConnection() {
    console.log('🔍 Testing backend connection...\n');
    
    try {
        // Test 1: Health check without auth
        console.log('1. Testing public health endpoint...');
        const healthRes = await fetch(`${BASE_URL}/payroll/history/health`);
        const health = await healthRes.json();
        console.log('   ✅ Response:', JSON.stringify(health, null, 2).substring(0, 200));
        
        // Test 2: Get current period
        console.log('\n2. Testing current period (needs auth)...');
        const periodRes = await fetch(`${BASE_URL}/payroll/current-period`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (periodRes.ok) {
            const period = await periodRes.json();
            console.log('   ✅ Auth working! Current period:', period);
        } else {
            console.log('   ❌ Auth failed! Status:', periodRes.status);
            const error = await periodRes.text();
            console.log('   Error:', error.substring(0, 200));
            return false;
        }
        
        return true;
    } catch (error: any) {
        console.error('   ❌ Connection error:', error.message);
        return false;
    }
}

async function runSeeder() {
    const month = 3; // Maret
    const year = 2026;
    const division = 'P1A'; // Test dengan 1 divisi
    
    console.log('\n🚀 Running Seeder...');
    console.log(`   Period: ${month}/${year}`);
    console.log(`   Division: ${division}`);
    console.log(`   Mode: PAYROLL\n`);
    
    try {
        const startTime = Date.now();
        
        const response = await fetch(`${BASE_URL}/payroll/history/seed`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                period_month: month,
                period_year: year,
                division_code: division,
                force: false,
                seederMode: 'PAYROLL'
            })
        });
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Seeder completed successfully!');
            console.log(`⏱️  Time: ${elapsed}s`);
            console.log('📊 Result:', JSON.stringify(result, null, 2));
            return true;
        } else {
            console.log(`❌ Seeder failed! Status: ${response.status}`);
            const error = await response.text();
            console.log('Error:', error.substring(0, 500));
            return false;
        }
    } catch (error: any) {
        console.error('❌ Seeder error:', error.message);
        return false;
    }
}

async function main() {
    console.log('=== TEST SEEDER DIRECT ===\n');
    console.log(`Token: ${authToken.substring(0, 20)}... (${authToken.length} chars)`);
    
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
        console.error('\n❌ Backend connection failed! Fix connection before running seeder.');
        process.exit(1);
    }
    
    // Run seeder
    const success = await runSeeder();
    
    if (success) {
        console.log('\n✅ TEST PASSED! Seeder working correctly.');
        process.exit(0);
    } else {
        console.log('\n❌ TEST FAILED! Check error messages above.');
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
