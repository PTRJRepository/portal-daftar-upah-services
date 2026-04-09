/**
 * Clean ALL history_gang_member duplicates comprehensively
 */
import { Database } from "./backend/src/db/client";

async function cleanAllDuplicates() {
    console.log("=== COMPREHENSIVE DUPLICATE CLEANUP ===\n");
    
    const historyDb = Database.getExtendedInstance();
    
    // Check total before cleanup
    console.log("--- Counting Duplicates Before Cleanup ---");
    const beforeCount = await historyDb.query<any>(`
        SELECT COUNT(*) as total_duplicates
        FROM (
            SELECT emp_code, gang_code, period_month, period_year
            FROM dbo.history_gang_member
            GROUP BY emp_code, gang_code, period_month, period_year
            HAVING COUNT(*) > 1
        ) AS dups
    `);
    
    console.log(`Total duplicate combinations: ${beforeCount[0].total_duplicates}`);
    
    // Clean ALL duplicates - keep only the latest entry
    console.log("\n--- Cleaning ALL Duplicates ---");
    try {
        const cleanSql = `
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
        `;
        
        const result = await historyDb.query(cleanSql);
        console.log("✅ Successfully cleaned all duplicates");
        
        // Verify after cleanup
        console.log("\n--- Counting Duplicates After Cleanup ---");
        const afterCount = await historyDb.query<any>(`
            SELECT COUNT(*) as remaining_duplicates
            FROM (
                SELECT emp_code, gang_code, period_month, period_year
                FROM dbo.history_gang_member
                GROUP BY emp_code, gang_code, period_month, period_year
                HAVING COUNT(*) > 1
            ) AS dups
        `);
        
        console.log(`Remaining duplicate combinations: ${afterCount[0].remaining_duplicates}`);
        
        // Show sample of remaining unique records
        const sampleSql = `
            SELECT TOP 10 
                emp_code, gang_code, period_month, period_year, created_at
            FROM dbo.history_gang_member
            ORDER BY created_at DESC
        `;
        const sample = await historyDb.query<any>(sampleSql);
        console.log("\nSample of recent records:");
        sample.forEach(row => {
            console.log(`  ${row.emp_code} in ${row.gang_code} (${row.period_month}/${row.period_year}) - ${row.created_at}`);
        });
        
    } catch (error: any) {
        console.error(`❌ Failed to clean duplicates: ${error.message}`);
        console.error(error.stack);
    }
    
    // Also check for duplicates in daftar_upah_aggregation_history
    console.log("\n--- Checking daftar_upah_aggregation_history for Duplicates ---");
    const aggDups = await historyDb.query<any>(`
        SELECT 
            division_code,
            gang_code,
            period_month,
            period_year,
            COUNT(*) as dup_count
        FROM dbo.daftar_upah_aggregation_history
        GROUP BY division_code, gang_code, period_month, period_year
        HAVING COUNT(*) > 1
        ORDER BY dup_count DESC
    `);
    
    if (aggDups.length > 0) {
        console.log(`Found ${aggDups.length} aggregation duplicates:`);
        aggDups.slice(0, 10).forEach(row => {
            console.log(`  ${row.division_code}/${row.gang_code} (${row.period_month}/${row.period_year}): ${row.dup_count} copies`);
        });
    } else {
        console.log("✅ No duplicates in daftar_upah_aggregation_history");
    }
    
    console.log("\n=== CLEANUP COMPLETE ===");
    console.log("\n⚠️  IMPORTANT: Re-seed affected divisions to ensure data consistency");
    console.log("   Run: npm run seed:division P1A 2 2026");
    console.log("   Run: npm run seed:division PG1B 2 2026");
    console.log("   Run: npm run seed:division ARA 2 2026");
    console.log("   (etc. for all affected divisions)");
}

cleanAllDuplicates().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
