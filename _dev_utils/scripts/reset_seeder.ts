/**
 * Force Reset Stuck Seeder
 * 
 * Usage: bun run reset_seeder.ts
 */

const API_URL = process.env.BACKEND_URL || 'http://localhost:8002';

async function resetSeeder() {
    console.log('🔄 Attempting to force reset stuck seeder...');
    
    try {
        const response = await fetch(`${API_URL}/payroll/history/seed/reset`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer system',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reason: 'Manual reset from script - seeder stuck'
            })
        });

        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Seeder reset successful!');
            console.log(`📝 Message: ${result.message}`);
            console.log('\nYou can now run the seeder again.');
        } else {
            console.error('❌ Reset failed:', result.error);
        }
    } catch (error: any) {
        console.error('❌ Network error:', error.message);
        console.log('\n💡 Make sure the backend server is running on', API_URL);
    }
}

resetSeeder();
