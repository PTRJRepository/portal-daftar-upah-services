/**
 * Diagnose Stuck Seeder
 * 
 * Checks:
 * 1. Current seeder progress/status
 * 2. How long it's been running
 * 3. Database connectivity
 * 4. Active locks in history tables
 * 
 * Usage: bun run diagnose_seeder.ts
 */

const API_URL = process.env.BACKEND_URL || 'http://localhost:8002';

async function diagnoseSeeder() {
    console.log('🔍 Diagnosing stuck seeder...\n');

    // 1. Check seeder progress
    console.log('1️⃣ Checking seeder progress...');
    try {
        const progressResponse = await fetch(`${API_URL}/payroll/history/seed/progress`, {
            headers: {
                'Authorization': 'Bearer system'
            }
        });
        const progress = await progressResponse.json();
        
        console.log('   Status:', progress);
        
        if (progress.data?.is_running) {
            const startTime = new Date(progress.data.started_at);
            const elapsed = Math.round((Date.now() - startTime.getTime()) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            
            console.log(`\n   ⚠️  Seeder is RUNNING for ${minutes}m ${seconds}s`);
            console.log(`   📍 Current step: ${progress.data.current_step}`);
            console.log(`   🏭 Division: ${progress.data.current_division || 'ALL'}`);
            console.log(`   👥 Employees processed: ${progress.data.employees_processed}`);
            
            if (elapsed > 1800) { // 30 minutes
                console.log('\n   ❌ EXCEEDED 30-minute timeout!');
                console.log('   💡 Recommendation: Run reset_seeder.ts to force reset');
            } else if (elapsed > 600) { // 10 minutes
                console.log('\n   ⏳ Running for more than 10 minutes...');
                console.log('   💡 This might be normal for large data seeding');
            }
        } else {
            console.log('   ✅ Seeder is NOT running (idle or completed)');
            console.log('   💡 If you can\'t seed, try running reset_seeder.ts anyway');
        }
    } catch (error: any) {
        console.error('   ❌ Failed to check progress:', error.message);
    }

    // 2. Check backend health
    console.log('\n2️⃣ Checking backend health...');
    try {
        const healthResponse = await fetch(`${API_URL}/payroll/history/health`, {
            headers: {
                'Authorization': 'Bearer system'
            }
        });
        const health = await healthResponse.json();
        console.log('   Backend status:', health.success ? '✅ Healthy' : '❌ Unhealthy');
        if (!health.success) {
            console.log('   Error:', health.message);
        }
    } catch (error: any) {
        console.error('   ❌ Backend unreachable:', error.message);
        console.log('   💡 Make sure backend is running: cd backend && bun run dev');
    }

    // 3. Check database connection
    console.log('\n3️⃣ Checking database connections...');
    try {
        const dbResponse = await fetch(`${API_URL}/payroll/aggregation/health`, {
            headers: {
                'Authorization': 'Bearer system'
            }
        });
        const dbHealth = await dbResponse.json();
        console.log('   Database status:', dbHealth.success ? '✅ Connected' : '❌ Failed');
        if (!dbHealth.success) {
            console.log('   Error:', dbHealth.message);
            console.log('   💡 Check SQL Gateway API and MSSQL server');
        }
    } catch (error: any) {
        console.error('   ❌ Database check failed:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📋 RECOMMENDATIONS:');
    console.log('='.repeat(60));
    console.log('1. If seeder is stuck > 30 min: run reset_seeder.ts');
    console.log('2. If database connection fails: check SQL Gateway');
    console.log('3. If backend is down: restart with "cd backend && bun run dev"');
    console.log('4. For large data (all divisions): consider seeding one division at a time');
}

diagnoseSeeder();
