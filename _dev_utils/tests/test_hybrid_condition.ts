/**
 * Verify the hybrid gangCondition works for PG1A
 * Simulates what DataExtractorService will generate
 */
import { Database } from '../../backend/src/db/client';
import { divisionConfigService } from '../../backend/src/services/config/DivisionConfigService';

async function verify() {
    const db = Database.getInstance();
    
    // 1. Get discovery list (same as what DataExtractorService does)
    const allGangs = await divisionConfigService.getGangsForDivision('PG1A');
    console.log(`Discovery found ${allGangs.length} gangs:`);
    for (const g of allGangs) {
        console.log(`  [${g.gang_code}] ${g.description} (loc: ${g.loc_code})`);
    }

    // 2. Build the same condition as DataExtractorService  
    const aliases = ['P1A', 'PG1A'];
    const placeholders = aliases.map(a => `'${a.toUpperCase()}'`).join(',');
    
    let locCondition = `(UPPER(RTRIM(g.LocCode)) IN (${placeholders}) OR UPPER(RTRIM(e.LocCode)) IN (${placeholders}))`;
    
    if (allGangs.length > 0) {
        const gangCodes = allGangs.map(g => `'${g.gang_code.trim().toUpperCase()}'`).join(',');
        locCondition = `(${locCondition} OR UPPER(RTRIM(gl.GangCode)) IN (${gangCodes}))`;
    }

    const virtualGangsToExclude = ['IN', 'INT', 'AMC', 'HMC', 'B2N'];
    const excludePlaceholders = virtualGangsToExclude.map(a => `'${a}'`).join(',');
    const gangCondition = locCondition + ` AND (UPPER(RTRIM(gl.GangCode)) NOT IN (${excludePlaceholders}))`;

    // 3. Run the query
    const query = `
        SELECT COUNT(*) as cnt, RTRIM(gl.GangCode) as gang
        FROM HR_EMPLOYEE e
        INNER JOIN HR_GANGLN gl ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
        LEFT JOIN HR_GANG g ON gl.GangCode = g.GangCode
        WHERE ${gangCondition}
        GROUP BY gl.GangCode
        ORDER BY gl.GangCode
    `;
    
    const result = await db.query<any>(query);
    console.log(`\nTotal gangs in extraction query: ${result.length}`);
    console.table(result);

    // 4. Check F1BHL specifically
    const hasF1BHL = result.some((r: any) => r.gang?.trim().toUpperCase() === 'F1BHL');
    console.log(`\n✅ F1BHL included: ${hasF1BHL}`);

    process.exit(0);
}

verify().catch(err => { console.error(err); process.exit(1); });
