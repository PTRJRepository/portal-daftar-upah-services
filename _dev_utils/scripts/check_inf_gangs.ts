/**
 * Check INF Gangs in HR_GANG
 * 
 * Run: cd backend && bun run check_inf_gangs.ts
 */

import { Database } from "./src/db/client";

async function checkInfgangs() {
    console.log('=== CHECK INF GANGS ===\n');

    const db = Database.getInstance();
    
    // Check HR_GANG for INF division
    const query = `
        SELECT gang_code, description, LocCode
        FROM dbo.HR_GANG
        WHERE LocCode = 'P1A' OR gang_code LIKE 'IN%' OR gang_code LIKE 'INT%'
        ORDER BY gang_code
    `;
    
    try {
        const result = await db.query<any>(query, []);
        console.log(`Found ${result.length} gangs:\n`);
        result.forEach((r: any) => {
            console.log(`  ${r.gang_code.padEnd(10)} | LocCode=${(r.LocCode || '').padEnd(6)} | ${r.description}`);
        });
    } catch (error: any) {
        console.log(`✗ ERROR: ${error.message}`);
    }

    console.log('\n=== CHECK COMPLETE ===');
}

checkInfgangs().catch(error => {
    console.error('\n❌ Fatal error:', error);
    console.error('Message:', error.message);
    process.exit(1);
});
