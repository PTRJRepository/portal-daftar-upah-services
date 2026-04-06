/**
 * Force Reset and Retry Seeder
 * 
 * 1. Resets the stuck seeder
 * 2. Waits 2 seconds
 * 3. Triggers a fresh seeder run for a SINGLE division (faster & safer)
 * 
 * Usage: bun run reset_and_reseed.ts [division] [month] [year]
 * Example: bun run reset_and_reseed.ts AB1 3 2026
 */

const API_URL = process.env.BACKEND_URL || 'http://localhost:8002';

const division = process.argv[2] || 'AB1';
const month = parseInt(process.argv[3] || '3');
const year = parseInt(process.argv[4] || '2026');

async function resetAndReseed() {
    console.log('🔄 Step 1: Resetting stuck seeder...');
    
    try {
        // Reset
        const resetResponse = await fetch(`${API_URL}/payroll/history/seed/reset`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer system',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reason: `Auto-reset before reseeding ${division} ${month}/${year}`
            })
        });
        
        const resetResult = await resetResponse.json();
        console.log('✅ Reset result:', resetResult);
        
        // Wait 2 seconds
        console.log('\n⏳ Waiting 2 seconds before reseed...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Trigger new seeder
        console.log(`\n🌱 Step 2: Triggering seeder for ${division} ${month}/${year}...`);
        
        const seedResponse = await fetch(`${API_URL}/payroll/history/seed`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer system',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                periodMonth: month,
                periodYear: year,
                divisionCode: division,
                gangCode: 'ALL',
                createdBy: 'system',
                force: true,
                seederMode: 'PAYROLL'
            })
        });
        
        const seedResult = await seedResponse.json();
        console.log('\n✅ Seeder triggered!');
        console.log('📊 Result:', JSON.stringify(seedResult, null, 2));
        
        // Poll progress
        console.log('\n📈 Monitoring progress...');
        for (let i = 0; i < 60; i++) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Check every 3s
            
            const progressResponse = await fetch(`${API_URL}/payroll/history/seed/progress`, {
                headers: { 'Authorization': 'Bearer system' }
            });
            const progress = await progressResponse.json();
            
            console.log(`   [${i + 1}] ${progress.current_step} | Division: ${progress.current_division || 'ALL'} | Gang: ${progress.current_gang || 'ALL'}`);
            
            if (!progress.is_running) {
                console.log('\n✅ Seeder completed!');
                console.log('   Final status:', progress.current_step);
                break;
            }
            
            if (i === 59) {
                console.log('\n⚠️  Still running after 3 minutes... check backend logs');
            }
        }
        
    } catch (error: any) {
        console.error('❌ Error:', error.message);
    }
}

resetAndReseed();
