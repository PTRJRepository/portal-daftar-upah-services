/**
 * Debug Wages Report 500 Error - Simple Version
 * 
 * Purpose: Check why wages report for Rebinmas (AB1, AB2) and IJL returns 500 error
 * 
 * Run: cd backend && bun run debug_wages_500_simple.ts
 */

import { Database } from "./src/db/client";

async function debugWagesError() {
    console.log('=== DEBUG WAGES 500 ERROR ===\n');

    const db = Database.getInstance();
    const divisions = ['AB1', 'AB2', 'IJL', 'ARB1', 'ARB2'];
    const calendarMonth = 3; // March
    const calendarYear = 2026;

    // Convert calendar to accounting (same logic as wagesService)
    const accMonth = ((calendarMonth + 2) % 12) + 1;
    const accYear = calendarMonth >= 10 ? calendarYear + 1 : calendarYear;
    
    console.log(`Calendar Period: ${calendarMonth}/${calendarYear}`);
    console.log(`Accounting Period: ${accMonth}/${accYear}\n`);

    // Test 1: Check PR_EMPWAGES table for these divisions
    console.log('--- Test 1: PR_EMPWAGES Data Check ---');
    for (const div of divisions) {
        console.log(`\nChecking PR_EMPWAGES for division="${div}"`);
        
        const query = `
            SELECT COUNT(*) as count
            FROM PR_EMPWAGES
            WHERE CAST(AccMonth AS INT) = ?
              AND CAST(AccYear AS INT) = ?
              AND (LocCode = ? OR DeptCode = ?)
        `;
        
        const params = [accMonth, accYear, div, div];
        
        try {
            const result = await db.query<any>(query, params);
            console.log(`  ✓ Found ${result[0]?.count || 0} records`);
            
            if (result[0]?.count > 0) {
                // Get sample
                const sampleQuery = `
                    SELECT TOP 3 EmpCode, EmpName, LocCode, DeptCode, Amount
                    FROM PR_EMPWAGES
                    WHERE CAST(AccMonth AS INT) = ?
                      AND CAST(AccYear AS INT) = ?
                      AND (LocCode = ? OR DeptCode = ?)
                `;
                const sample = await db.query<any>(sampleQuery, params);
                console.log(`  Sample: ${sample.map((r: any) => `${r.EmpCode} (${r.LocCode || r.DeptCode})`).join(', ')}`);
            }
        } catch (error: any) {
            console.log(`  ✗ ERROR: ${error.message}`);
        }
    }

    // Test 2: Check PR_EMPWAGES without division filter
    console.log('\n\n--- Test 2: PR_EMPWAGES All Data (No Division Filter) ---');
    
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
            console.log('Sample data:');
            result.forEach((r: any) => {
                console.log(`  ${r.EmpCode} | LocCode=${r.LocCode} | DeptCode=${r.DeptCode} | Amount=${r.Amount}`);
            });
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
            resultArc.forEach((r: any) => {
                console.log(`  ${r.EmpCode} | LocCode=${r.LocCode} | DeptCode=${r.DeptCode} | Amount=${r.Amount}`);
            });
        } catch (errorArc: any) {
            console.log(`✗ ERROR querying PR_EMPWAGES_ARC: ${errorArc.message}`);
        }
    }

    // Test 3: Check what divisions actually exist in PR_EMPWAGES
    console.log('\n\n--- Test 3: Available Divisions in PR_EMPWAGES ---');
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
        const divList = result.map((r: any) => r.LocCode || r.DeptCode).filter(Boolean);
        console.log('Divisions:', divList.join(', '));
        
        // Check if our target divisions are in the list
        for (const target of divisions) {
            const found = divList.includes(target);
            console.log(`  ${target}: ${found ? '✓ FOUND' : '✗ NOT FOUND'}`);
        }
    } catch (error: any) {
        console.log(`✗ ERROR: ${error.message}`);
    }

    console.log('\n=== DEBUG COMPLETE ===');
}

debugWagesError().catch(error => {
    console.error('\n❌ Fatal error:', error);
    console.error('Message:', error.message);
    process.exit(1);
});
