/**
 * Direct test of virtual division extraction logic
 * 
 * Run: cd backend && bun run test_extraction.ts
 */

import { divisionDefinition } from "./src/services/divisionDefinition";
import { Database } from "./src/db/client";

async function testExtraction() {
    console.log('=== TEST VIRTUAL DIVISION EXTRACTION ===\n');

    const extendDb = Database.getExtendedInstance();
    const month = 3;
    const year = 2026;

    // Get all gang rows
    const query = `
        SELECT gang_code, division_code, total_employees, total_upah_bersih, total_premi
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ?
        ORDER BY gang_code
    `;
    
    const rows = await extendDb.query<any>(query, [month, year]);
    console.log(`Found ${rows.length} gangs\n`);

    // Simulate STEP 2 logic
    const virtualDivAgg: Record<string, any> = {};
    const gangDivMap: Record<string, string> = {};

    for (const row of rows) {
        const gangCode = row.gang_code?.trim() || '';
        const sourceLoc = row.division_code?.trim() || '';
        const gangDesc = '';
        
        let virtualDiv: string | null = null;
        virtualDiv = divisionDefinition.getVirtualDivisionForGang(gangCode, sourceLoc, gangDesc);
        
        if (!virtualDiv && !gangDivMap[gangCode]) {
            virtualDiv = divisionDefinition.getVirtualDivisionByPatternOnly(gangCode, gangDesc);
        }
        
        if (virtualDiv === 'WORKSHOP' || virtualDiv === 'ARC' || virtualDiv === 'MILL') {
            console.log(`⏭️  ${gangCode.padEnd(8)} (source=${sourceLoc.padEnd(6)}) → Skipped (${virtualDiv})`);
            continue;
        }
        
        if (virtualDiv) {
            if (!virtualDivAgg[virtualDiv]) {
                virtualDivAgg[virtualDiv] = { emp: 0, upah: 0, premi: 0, gangs: [] };
            }
            virtualDivAgg[virtualDiv].emp += row.total_employees || 0;
            virtualDivAgg[virtualDiv].upah += row.total_upah_bersih || 0;
            virtualDivAgg[virtualDiv].premi += row.total_premi || 0;
            virtualDivAgg[virtualDiv].gangs.push(gangCode);
            console.log(`✅ ${gangCode.padEnd(8)} (source=${sourceLoc.padEnd(6)}) → ${virtualDiv}`);
        }
    }

    console.log('\n--- Virtual Divisions Aggregated ---');
    Object.entries(virtualDivAgg).forEach(([div, data]: [string, any]) => {
        console.log(`  ${div.padEnd(12)}: ${data.gangs.length} gangs, ${data.emp} emp, ${data.upah} upah, ${data.premi} premi`);
        console.log(`    Gangs: ${data.gangs.join(', ')}`);
    });

    console.log('\n=== TEST COMPLETE ===');
}

testExtraction().catch(error => {
    console.error('\n❌ Fatal error:', error);
    console.error('Message:', error.message);
    process.exit(1);
});
