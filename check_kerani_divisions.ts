/**
 * Check Kerani user divisions
 */

import { AuthService } from './backend/src/services/authService';

async function checkKeraniDivisions() {
    console.log('='.repeat(80));
    console.log('CHECKING KERANI USER DIVISIONS');
    console.log('='.repeat(80));
    
    // Read token from environment or use a test token
    const token = process.env.TEST_TOKEN;
    
    if (!token) {
        console.log('\n⚠️  No TEST_TOKEN found in environment');
        console.log('Please check your browser\'s localStorage for the auth token:');
        console.log('1. Open DevTools (F12) → Application → Local Storage');
        console.log('2. Find the key containing your auth token');
        console.log('3. Run: TEST_TOKEN=<your-token> bun run check_kerani_divisions.ts');
        return;
    }

    const authService = AuthService.getInstance();
    
    try {
        const user = await authService.verifyToken(token);
        
        if (!user) {
            console.log('\n❌ Invalid token');
            return;
        }
        
        console.log('\nUser Info:');
        console.log(`  Username: ${user.username}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Divisions: ${JSON.stringify(user.divisions)}`);
        
        if (user.role?.toLowerCase() === 'kerani') {
            console.log('\n⚠️  Kerani role detected!');
            console.log('   Backend will OVERRIDE division parameter with: ' + user.divisions?.[0]);
            console.log('   This means selecting PG2A in UI will be ignored!');
        }
    } catch (error: any) {
        console.log(`\n❌ Error: ${error.message}`);
    }
}

checkKeraniDivisions()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
