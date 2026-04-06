/**
 * Check if NRS, WKS_PG, WKS_AR gangs exist in aggregation
 * 
 * Run: cd backend && bun run check_virtual_gangs.ts
 */

import { Database } from "./src/db/client";

async function checkVirtualGangs() {
    console.log('=== CHECK VIRTUAL GANGS IN AGGREGATION ===\n');

    const extendDb = Database.getExtendedInstance();
    const month = 3;
    const year = 2026;

    // Check specific gangs
    const query = `
        SELECT gang_code, division_code, total_employees, total_upah_bersih, total_premi
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        AND gang_code IN ('AMC', 'HMC', 'B2N')
        ORDER BY gang_code
    `;
    
    try {
        const result = await extendDb.query<any>(query, [month, year]);
        console.log(`Found ${result.length} virtual gangs:\n`);
        result.forEach((r: any) => {
            console.log(`  ${r.gang_code.padEnd(8)} | div=${r.division_code.padEnd(6)} | emp=${r.total_employees} | upah=${r.total_upah_bersih} | premi=${r.total_premi}`);
        });
        
        if (result.length === 0) {
            console.log('⚠️  No virtual gangs found in aggregation history!');
            console.log('This means AMC, HMC, B2N were not stored separately.');
            console.log('They might be included in parent division totals instead.');
        }
    } catch (error: any) {
        console.log(`✗ ERROR: ${error.message}`);
    }

    console.log('\n=== CHECK COMPLETE ===');
}

checkVirtualGangs().catch(error => {
    console.error('\n❌ Fatal error:', error);
    console.error('Message:', error.message);
    process.exit(1);
});
