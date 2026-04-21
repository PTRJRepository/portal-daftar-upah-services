/**
 * Test getAllDivisionsPremiTotals with includeVirtual
 * 
 * Run: cd backend && bun run test_premi_totals.ts
 */

import { summaryService } from "./src/services/summaryService";

async function testPremiTotals() {
    console.log('=== TEST getAllDivisionsPremiTotals ===\n');

    const month = 3;
    const year = 2026;

    console.log('--- Test 1: includeVirtual=false ---');
    try {
        const result1 = await summaryService.getAllDivisionsPremiTotals(month, year, false);
        console.log(`Result: ${result1.length} divisions`);
        console.log('Divisions:', result1.map(r => r.division_code).join(', '));
        
        const virtuals = result1.filter(r => ['INF', 'NRS', 'WKS_PG', 'WKS_AR', 'WORKSHOP', 'MILL'].includes(r.division_code));
        console.log(`Virtual divisions found: ${virtuals.length}`);
        virtuals.forEach(v => {
            console.log(`  ${v.division_code}: emp=${v.total_employees}, upah=${v.total_upah_bersih}`);
        });
    } catch (error: any) {
        console.log(`✗ ERROR: ${error.message}`);
    }

    console.log('\n--- Test 2: includeVirtual=true ---');
    try {
        const result2 = await summaryService.getAllDivisionsPremiTotals(month, year, true);
        console.log(`Result: ${result2.length} divisions`);
        console.log('Divisions:', result2.map(r => r.division_code).join(', '));
        
        const virtuals = result2.filter(r => ['INF', 'NRS', 'WKS_PG', 'WKS_AR', 'WORKSHOP', 'MILL'].includes(r.division_code));
        console.log(`Virtual divisions found: ${virtuals.length}`);
        virtuals.forEach(v => {
            console.log(`  ${v.division_code}: emp=${v.total_employees}, upah=${v.total_upah_bersih}, premi=${v.total_premi}`);
        });
    } catch (error: any) {
        console.log(`✗ ERROR: ${error.message}`);
    }

    console.log('\n=== TEST COMPLETE ===');
}

testPremiTotals().catch(error => {
    console.error('\n❌ Fatal error:', error);
    console.error('Message:', error.message);
    process.exit(1);
});
