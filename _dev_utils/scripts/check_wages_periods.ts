/**
 * Check what periods exist in PR_EMPWAGES
 * 
 * Run: cd backend && bun run check_wages_periods.ts
 */

import { Database } from "./src/db/client";

async function checkWagesPeriods() {
    console.log('=== CHECK WAGES PERIODS ===\n');

    const db = Database.getInstance();

    // Check all available periods in PR_EMPWAGES
    console.log('--- Available Periods in PR_EMPWAGES ---');
    const query = `
        SELECT DISTINCT 
            CAST(AccMonth AS INT) as month, 
            CAST(AccYear AS INT) as year,
            COUNT(*) as emp_count
        FROM PR_EMPWAGES
        GROUP BY CAST(AccMonth AS INT), CAST(AccYear AS INT)
        ORDER BY year DESC, month DESC
    `;
    
    try {
        const result = await db.query<any>(query, []);
        console.log(`Found ${result.length} periods:\n`);
        result.forEach((r: any) => {
            console.log(`  Month ${r.month}/${r.year}: ${r.emp_count} employees`);
        });
    } catch (error: any) {
        console.log(`✗ ERROR querying PR_EMPWAGES: ${error.message}`);
    }

    // Check PR_EMPWAGES_ARC
    console.log('\n--- Available Periods in PR_EMPWAGES_ARC ---');
    const queryArc = `
        SELECT DISTINCT 
            CAST(AccMonth AS INT) as month, 
            CAST(AccYear AS INT) as year,
            COUNT(*) as emp_count
        FROM PR_EMPWAGES_ARC
        GROUP BY CAST(AccMonth AS INT), CAST(AccYear AS INT)
        ORDER BY year DESC, month DESC
    `;
    
    try {
        const resultArc = await db.query<any>(queryArc, []);
        console.log(`Found ${resultArc.length} periods:\n`);
        resultArc.forEach((r: any) => {
            console.log(`  Month ${r.month}/${r.year}: ${r.emp_count} employees`);
        });
    } catch (errorArc: any) {
        console.log(`✗ ERROR querying PR_EMPWAGES_ARC: ${errorArc.message}`);
    }

    // Check recent periods (last 6 months from current date)
    console.log('\n--- Checking Recent Periods (Feb-Apr 2026) ---');
    const periods = [
        { month: 2, year: 2026 },
        { month: 3, year: 2026 },
        { month: 4, year: 2026 }
    ];

    for (const period of periods) {
        const accMonth = ((period.month + 2) % 12) + 1;
        const accYear = period.month >= 10 ? period.year + 1 : period.year;
        
        console.log(`\nCalendar: ${period.month}/${period.year} -> Accounting: ${accMonth}/${accYear}`);
        
        const queryCheck = `
            SELECT COUNT(*) as count
            FROM PR_EMPWAGES
            WHERE CAST(AccMonth AS INT) = ?
              AND CAST(AccYear AS INT) = ?
        `;
        
        try {
            const result = await db.query<any>(queryCheck, [accMonth, accYear]);
            console.log(`  PR_EMPWAGES: ${result[0]?.count || 0} records`);
        } catch (error: any) {
            console.log(`  PR_EMPWAGES ERROR: ${error.message}`);
        }
    }

    console.log('\n=== CHECK COMPLETE ===');
}

checkWagesPeriods().catch(error => {
    console.error('\n❌ Fatal error:', error);
    console.error('Message:', error.message);
    process.exit(1);
});
