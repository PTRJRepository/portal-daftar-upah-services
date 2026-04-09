/**
 * Clean up history_gang_member duplicates
 */
import { Database } from "./backend/src/db/client";

async function cleanHistoryGangMemberDuplicates() {
    console.log("=== CLEANING HISTORY_GANG_MEMBER DUPLICATES ===\n");
    
    const historyDb = Database.getExtendedInstance();
    
    // Check total duplicates
    console.log("--- Checking for Duplicates in history_gang_member ---");
    const duplicates = await historyDb.query<any>(`
        SELECT 
            emp_code,
            gang_code,
            period_month,
            period_year,
            COUNT(*) as dup_count
        FROM dbo.history_gang_member
        GROUP BY emp_code, gang_code, period_month, period_year
        HAVING COUNT(*) > 1
        ORDER BY dup_count DESC, period_year DESC, period_month DESC
    `);
    
    if (duplicates.length > 0) {
        console.log(`Found ${duplicates.length} employee/gang/period combinations with duplicates:`);
        duplicates.slice(0, 20).forEach(row => {
            console.log(`  ${row.emp_code} in ${row.gang_code} (${row.period_month}/${row.period_year}): ${row.dup_count} copies`);
        });
        if (duplicates.length > 20) {
            console.log(`  ... and ${duplicates.length - 20} more`);
        }
        
        // Ask user if they want to clean
        console.log("\n💡 To clean duplicates, run this SQL in SSMS:");
        console.log(`
-- Keep only the LATEST entry for each emp_code + gang_code + period combination
WITH RankedMembers AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (
            PARTITION BY emp_code, gang_code, period_month, period_year 
            ORDER BY created_at DESC
        ) as rn
    FROM dbo.history_gang_member
)
DELETE FROM RankedMembers WHERE rn > 1;
        `);
    } else {
        console.log("✅ No duplicates found in history_gang_member");
    }
    
    // Clean B0720 and F0440 specifically for 2/2026
    console.log("\n--- Cleaning B0720 and F0440 for 2/2026 ---");
    
    try {
        // Keep only the latest B0720 for each gang in 2/2026
        const deleteB0720 = `
            WITH RankedMembers AS (
                SELECT 
                    *,
                    ROW_NUMBER() OVER (
                        PARTITION BY emp_code, gang_code, period_month, period_year 
                        ORDER BY created_at DESC
                    ) as rn
                FROM dbo.history_gang_member
                WHERE emp_code = 'B0720' AND period_month = 2 AND period_year = 2026
            )
            DELETE FROM RankedMembers WHERE rn > 1;
        `;
        await historyDb.query(deleteB0720);
        console.log("✅ Cleaned B0720 duplicates for 2/2026");
        
        // Keep only the latest F0440 for each gang in 2/2026
        const deleteF0440 = `
            WITH RankedMembers AS (
                SELECT 
                    *,
                    ROW_NUMBER() OVER (
                        PARTITION BY emp_code, gang_code, period_month, period_year 
                        ORDER BY created_at DESC
                    ) as rn
                FROM dbo.history_gang_member
                WHERE emp_code = 'F0440' AND period_month = 2 AND period_year = 2026
            )
            DELETE FROM RankedMembers WHERE rn > 1;
        `;
        await historyDb.query(deleteF0440);
        console.log("✅ Cleaned F0440 duplicates for 2/2026");
        
        // Verify
        const verifyB0720 = await historyDb.query<any>(`
            SELECT emp_code, gang_code, period_month, period_year, COUNT(*) as cnt
            FROM dbo.history_gang_member
            WHERE emp_code = 'B0720' AND period_month = 2 AND period_year = 2026
            GROUP BY emp_code, gang_code, period_month, period_year
        `);
        
        const verifyF0440 = await historyDb.query<any>(`
            SELECT emp_code, gang_code, period_month, period_year, COUNT(*) as cnt
            FROM dbo.history_gang_member
            WHERE emp_code = 'F0440' AND period_month = 2 AND period_year = 2026
            GROUP BY emp_code, gang_code, period_month, period_year
        `);
        
        console.log(`\nB0720 now has ${verifyB0720.length} unique gang entries for 2/2026:`);
        verifyB0720.forEach(row => {
            console.log(`  ${row.gang_code}: ${row.cnt} record(s)`);
        });
        
        console.log(`\nF0440 now has ${verifyF0440.length} unique gang entries for 2/2026:`);
        verifyF0440.forEach(row => {
            console.log(`  ${row.gang_code}: ${row.cnt} record(s)`);
        });
        
    } catch (error: any) {
        console.error(`❌ Failed to clean duplicates: ${error.message}`);
    }
    
    console.log("\n=== CLEAN COMPLETE ===");
}

cleanHistoryGangMemberDuplicates().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
