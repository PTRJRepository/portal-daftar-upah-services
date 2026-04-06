/**
 * Debug STEP 2 - Virtual Division Extraction
 * 
 * Run: cd backend && bun run debug_step2.ts
 */

import { divisionDefinition } from "./src/services/divisionDefinition";
import { Database } from "./src/db/client";

async function debugStep2() {
    console.log('=== DEBUG STEP 2 - Virtual Division Extraction ===\n');

    const extendDb = Database.getExtendedInstance();
    const month = 3;
    const year = 2026;

    // Get all gang rows
    console.log('--- Getting Gang Data ---');
    const query = `
        SELECT gang_code, division_code, total_employees, total_upah_bersih, total_premi, total_lembur
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        ORDER BY gang_code
    `;
    
    const rows = await extendDb.query<any>(query, [month, year]);
    console.log(`Found ${rows.length} gangs\n`);

    // Test virtual division detection for each gang
    console.log('--- Testing Virtual Division Detection ---\n');
    const virtualCounts: Record<string, number> = {};
    
    for (const row of rows) {
        const gangCode = row.gang_code?.trim() || '';
        const sourceLoc = row.division_code?.trim() || '';
        const gangDesc = ''; // We don't have description from aggregation history
        
        // Check virtual division
        let virtualDiv: string | null = null;
        virtualDiv = divisionDefinition.getVirtualDivisionForGang(gangCode, sourceLoc, gangDesc);
        
        // Fallback
        if (!virtualDiv) {
            virtualDiv = divisionDefinition.getVirtualDivisionByPatternOnly(gangCode, gangDesc);
        }
        
        if (virtualDiv) {
            if (!virtualCounts[virtualDiv]) virtualCounts[virtualDiv] = 0;
            virtualCounts[virtualDiv]++;
            console.log(`✅ ${gangCode.padEnd(8)} (source=${sourceLoc.padEnd(6)}) → ${virtualDiv}`);
        } else if (gangCode.startsWith('IN') || gangCode.startsWith('AMC') || gangCode.startsWith('HMC') || gangCode.startsWith('B2N')) {
            console.log(`❌ ${gangCode.padEnd(8)} (source=${sourceLoc.padEnd(6)}) → NOT DETECTED (should be virtual)`);
        }
    }

    console.log('\n--- Virtual Division Gang Counts ---');
    console.log('Virtual divisions detected from gangs:');
    Object.entries(virtualCounts).forEach(([div, count]) => {
        console.log(`  ${div.padEnd(12)}: ${count} gangs`);
    });

    // Check specific gangs that should be detected
    console.log('\n--- Checking Specific Virtual Gangs ---');
    const checkGangs = ['AMC', 'HMC', 'B2N', 'IN01', 'IN1', 'INF', 'INT'];
    for (const gang of checkGangs) {
        const exists = rows.some(r => r.gang_code === gang);
        console.log(`  ${gang.padEnd(8)}: ${exists ? 'EXISTS in aggregation' : 'NOT FOUND'}`);
    }

    console.log('\n=== DEBUG COMPLETE ===');
}

debugStep2().catch(error => {
    console.error('\n❌ Fatal error:', error);
    console.error('Message:', error.message);
    process.exit(1);
});
