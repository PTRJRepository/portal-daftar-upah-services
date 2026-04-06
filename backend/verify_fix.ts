/**
 * Quick verification of current service state
 * 
 * Run: cd backend && bun run verify_fix.ts
 */

import { summaryService } from "./src/services/summaryService";

async function verifyFix() {
    console.log('=== VERIFY FIX - Direct Service Call ===\n');

    const month = 3;
    const year = 2026;

    console.log('Calling getAllDivisionsPremiTotals with includeVirtual=true...');
    const result = await summaryService.getAllDivisionsPremiTotals(month, year, true);
    
    console.log(`\n✅ Result: ${result.length} divisions\n`);
    
    // Check virtual divisions
    const virtualDivs = ['INF', 'NRS', 'WKS_PG', 'WKS_AR', 'WORKSHOP', 'MILL', 'ARC'];
    
    console.log('Virtual Divisions Status:');
    console.log('─'.repeat(80));
    
    for (const div of virtualDivs) {
        const found = result.find(r => r.division_code === div);
        if (found) {
            const hasData = found.total_employees > 0 || found.total_upah_bersih > 0;
            const status = hasData ? '✅ HAS DATA' : '❌ ZERO DATA';
            console.log(`${div.padEnd(12)} | emp=${found.total_employees.toString().padStart(4)} | upah=${found.total_upah_bersih.toFixed(0).padStart(12)} | premi=${found.total_premi.toFixed(0).padStart(10)} | ${status}`);
        } else {
            console.log(`${div.padEnd(12)} | ❌ NOT FOUND IN RESULT`);
        }
    }
    
    console.log('\n' + '─'.repeat(80));
    console.log(`\nAll divisions (${result.length}):`);
    console.log(result.map(r => r.division_code).join(', '));

    console.log('\n=== VERIFY COMPLETE ===');
}

verifyFix().catch(error => {
    console.error('\n❌ Fatal error:', error);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
});
