/**
 * Debug Wages Report 500 Error
 * 
 * Purpose: Check why wages report for Rebinmas (AB1, AB2) and IJL returns 500 error
 * 
 * Run: cd backend && bun run debug_wages_500.ts
 */

import { Database } from "./src/db/client";
import { divisionDefinition } from "./src/services/divisionDefinition";

async function debugWagesError() {
    console.log('=== DEBUG WAGES 500 ERROR ===\n');

    const db = Database.getInstance();
    const divisions = ['AB1', 'AB2', 'IJL'];
    const month = 3; // April (accounting month)
    const year = 2026;

    // Test 1: Check if divisions exist and get their aliases
    console.log('--- Test 1: Division Resolution ---');
    const allDivisions = await divisionDefinition.getAllDivisions();
    
    for (const div of divisions) {
        console.log(`\nDivision: ${div}`);
        const aliases = allDivisions.find(d => d.code === div || d.aliases.includes(div));
        console.log(`  Found: ${aliases?.code || 'NOT FOUND'}`);
        console.log(`  Aliases: ${aliases?.aliases.join(', ') || 'N/A'}`);
        
        const sourceDivs = await divisionDefinition.getSourceDivisionsForAggregation(div);
        console.log(`  Source Divisions for Aggregation: ${sourceDivs.join(', ')}`);
    }

    // Test 2: Check PR_EMPWAGES table for these divisions
    console.log('\n\n--- Test 2: PR_EMPWAGES Data Check ---');
    for (const div of divisions) {
        console.log(`\nChecking PR_EMPWAGES for ${div} (month=${month}, year=${year})`);
        
        // Convert calendar to accounting
        const accMonth = ((month + 2) % 12) + 1;
        const accYear = month >= 10 ? year + 1 : year;
        
        const sourceDivs = await divisionDefinition.getSourceDivisionsForAggregation(div);
        console.log(`  Accounting Period: ${accMonth}/${accYear}`);
        console.log(`  Source Divisions: ${sourceDivs.join(', ')}`);
        
        const placeholders = sourceDivs.map(() => '?').join(',');
        const query = `
            SELECT COUNT(*) as count
            FROM PR_EMPWAGES
            WHERE CAST(AccMonth AS INT) = ?
              AND CAST(AccYear AS INT) = ?
              AND (LocCode IN (${placeholders}) OR DeptCode IN (${placeholders}))
        `;
        
        const params = [accMonth, accYear, ...sourceDivs, ...sourceDivs];
        
        try {
            const result = await db.query<any>(query, params);
            console.log(`  ✓ Found ${result[0]?.count || 0} records`);
        } catch (error: any) {
            console.log(`  ✗ ERROR: ${error.message}`);
        }
    }

    // Test 3: Check PR_EMPWAGES without division filter
    console.log('\n\n--- Test 3: PR_EMPWAGES All Data (No Division Filter) ---');
    const accMonth = ((month + 2) % 12) + 1;
    const accYear = month >= 10 ? year + 1 : year;
    
    const queryAll = `
        SELECT TOP 10 
            EmpCode, EmpName, LocCode, DeptCode, 
            CAST(AccMonth AS INT) as accMonth, 
            CAST(AccYear AS INT) as accYear,
            Amount
        FROM PR_EMPWAGES
        WHERE CAST(AccMonth AS INT) = ?
          AND CAST(AccYear AS INT) = ?
        ORDER BY EmpName
    `;
    
    try {
        const result = await db.query<any>(queryAll, [accMonth, accYear]);
        console.log(`✓ Found ${result.length} sample records`);
        if (result.length > 0) {
            console.log('Sample data:', JSON.stringify(result[0], null, 2));
        }
    } catch (error: any) {
        console.log(`✗ ERROR querying PR_EMPWAGES: ${error.message}`);
        console.log('\nTrying PR_EMPWAGES_ARC...');
        
        try {
            const queryArc = `
                SELECT TOP 10 
                    EmpCode, EmpName, LocCode, DeptCode, 
                    CAST(AccMonth AS INT) as accMonth, 
                    CAST(AccYear AS INT) as accYear,
                    Amount
                FROM PR_EMPWAGES_ARC
                WHERE CAST(AccMonth AS INT) = ?
                  AND CAST(AccYear AS INT) = ?
                ORDER BY EmpName
            `;
            
            const resultArc = await db.query<any>(queryArc, [accMonth, accYear]);
            console.log(`✓ Found ${resultArc.length} sample records from ARC`);
            if (resultArc.length > 0) {
                console.log('Sample ARC data:', JSON.stringify(resultArc[0], null, 2));
            }
        } catch (errorArc: any) {
            console.log(`✗ ERROR querying PR_EMPWAGES_ARC: ${errorArc.message}`);
        }
    }

    // Test 4: Check what divisions actually exist in PR_EMPWAGES
    console.log('\n\n--- Test 4: Available Divisions in PR_EMPWAGES ---');
    const queryDivs = `
        SELECT DISTINCT LocCode, DeptCode
        FROM PR_EMPWAGES
        WHERE CAST(AccMonth AS INT) = ?
          AND CAST(AccYear AS INT) = ?
        ORDER BY LocCode
    `;
    
    try {
        const result = await db.query<any>(queryDivs, [accMonth, accYear]);
        console.log(`✓ Found ${result.length} distinct divisions`);
        console.log('Divisions:', result.map((r: any) => r.LocCode || r.DeptCode).join(', '));
    } catch (error: any) {
        console.log(`✗ ERROR: ${error.message}`);
    }

    console.log('\n=== DEBUG COMPLETE ===');
    console.log('\nNext steps:');
    console.log('1. Check if the accounting month conversion is correct');
    console.log('2. Verify that LocCode/DeptCode matches division codes');
    console.log('3. Check backend logs for actual error message');
}

debugWagesError().catch(error => {
    console.error('\n❌ Fatal error:', error);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
});
