/**
 * Fix duplicate aggregation data
 * - Remove AMC from P1A (should only exist in WKS_PG)
 * - Fix employees appearing in multiple gangs
 */
import { Database } from "./backend/src/db/client";

async function fixDuplicates() {
    console.log("=== FIXING AGGREGATION DUPLICATES ===\n");
    
    const db = Database.getExtendedInstance();
    
    // Fix 1: Remove AMC gang from P1A division (it should only be in WKS_PG)
    console.log("--- Fix 1: Remove AMC from P1A Division ---");
    try {
        const checkSql = `
            SELECT COUNT(*) as cnt 
            FROM dbo.daftar_upah_aggregation_history 
            WHERE division_code = 'P1A' AND gang_code = 'AMC'
        `;
        const checkResult = await db.query<any>(checkSql);
        const countBefore = checkResult[0].cnt;
        
        if (countBefore > 0) {
            console.log(`Found ${countBefore} AMC records in P1A division`);
            
            const deleteSql = `
                DELETE FROM dbo.daftar_upah_aggregation_history 
                WHERE division_code = 'P1A' AND gang_code = 'AMC'
            `;
            await db.query(deleteSql);
            
            const verifyResult = await db.query(checkSql);
            const countAfter = verifyResult[0].cnt;
            console.log(`✅ Deleted ${countBefore - countAfter} AMC records from P1A. Remaining: ${countAfter}`);
        } else {
            console.log("✅ No AMC records found in P1A division");
        }
    } catch (error: any) {
        console.error(`❌ Failed to remove AMC from P1A: ${error.message}`);
    }
    
    // Fix 1b: Also remove AMC from WKS_AR and WKS divisions
    console.log("\n--- Fix 1b: Remove AMC from WKS_AR and WKS Divisions ---");
    try {
        const divisionsToClean = ['WKS_AR', 'WKS', 'AB2'];
        for (const div of divisionsToClean) {
            const checkSql = `
                SELECT COUNT(*) as cnt 
                FROM dbo.daftar_upah_aggregation_history 
                WHERE division_code = ? AND gang_code = 'AMC'
            `;
            const checkResult = await db.query<any>(checkSql, [div]);
            const countBefore = checkResult[0].cnt;
            
            if (countBefore > 0) {
                const deleteSql = `
                    DELETE FROM dbo.daftar_upah_aggregation_history 
                    WHERE division_code = ? AND gang_code = 'AMC'
                `;
                await db.query(deleteSql, [div]);
                console.log(`✅ Deleted ${countBefore} AMC records from ${div}`);
            }
        }
        
        // Also remove HMC from wrong divisions
        const hmcDivisionsToClean = ['AB2', 'WKS'];
        for (const div of hmcDivisionsToClean) {
            const checkSql = `
                SELECT COUNT(*) as cnt 
                FROM dbo.daftar_upah_aggregation_history 
                WHERE division_code = ? AND gang_code = 'HMC'
            `;
            const checkResult = await db.query<any>(checkSql, [div]);
            const countBefore = checkResult[0].cnt;
            
            if (countBefore > 0) {
                const deleteSql = `
                    DELETE FROM dbo.daftar_upah_aggregation_history 
                    WHERE division_code = ? AND gang_code = 'HMC'
                `;
                await db.query(deleteSql, [div]);
                console.log(`✅ Deleted ${countBefore} HMC records from ${div}`);
            }
        }
    } catch (error: any) {
        console.error(`❌ Failed to clean virtual gangs: ${error.message}`);
    }
    
    // Fix 2: Check and fix employees in multiple gangs for current period (2/2026)
    console.log("\n--- Fix 2: Employees in Multiple Gangs (2/2026) ---");
    try {
        const multiGangEmps = await db.query<any>(`
            SELECT 
                emp_code,
                emp_name,
                period_month,
                period_year,
                COUNT(DISTINCT gang_code) as gang_count,
                STRING_AGG(CAST(gang_code AS VARCHAR), ', ') within group (order by gang_code) as gangs
            FROM dbo.history_gang_member
            WHERE period_month = 2 AND period_year = 2026
            GROUP BY emp_code, emp_name, period_month, period_year
            HAVING COUNT(DISTINCT gang_code) > 1
        `);
        
        if (multiGangEmps.length > 0) {
            console.log(`Found ${multiGangEmps.length} employees in multiple gangs:`);
            multiGangEmps.forEach(row => {
                console.log(`  ${row.emp_code} - ${row.emp_name}: [${row.gangs}]`);
            });
            
            // For now, just report - we need business logic to decide which gang to keep
            console.log("\n⚠️ These employees need manual review to determine correct gang assignment");
        } else {
            console.log("✅ No employees in multiple gangs for 2/2026");
        }
    } catch (error: any) {
        console.error(`❌ Failed to check multi-gang employees: ${error.message}`);
    }
    
    // Fix 3: Ensure virtual gangs are properly separated
    console.log("\n--- Fix 3: Verify Virtual Gang Separation ---");
    try {
        // Check AMC in WKS_PG
        const amcInWksPg = await db.query<any>(`
            SELECT COUNT(*) as cnt, period_month, period_year
            FROM dbo.daftar_upah_aggregation_history
            WHERE division_code = 'WKS_PG' AND gang_code = 'AMC'
            GROUP BY period_month, period_year
            ORDER BY period_year DESC, period_month DESC
        `);
        
        console.log(`AMC in WKS_PG: ${amcInWksPg.length} records`);
        
        // Check HMC in WKS_AR
        const hmcInWksAr = await db.query<any>(`
            SELECT COUNT(*) as cnt, period_month, period_year
            FROM dbo.daftar_upah_aggregation_history
            WHERE division_code = 'WKS_AR' AND gang_code = 'HMC'
            GROUP BY period_month, period_year
            ORDER BY period_year DESC, period_month DESC
        `);
        
        console.log(`HMC in WKS_AR: ${hmcInWksAr.length} records`);
        
        // Check if AMC or HMC appear in their parent divisions
        const amcInParent = await db.query<any>(`
            SELECT division_code, COUNT(*) as cnt
            FROM dbo.daftar_upah_aggregation_history
            WHERE gang_code = 'AMC' AND division_code != 'WKS_PG'
            GROUP BY division_code
        `);
        
        if (amcInParent.length > 0) {
            console.log(`\n⚠️ AMC still appears in these divisions (should be removed):`);
            amcInParent.forEach(row => {
                console.log(`  ${row.division_code}: ${row.cnt} records`);
            });
        } else {
            console.log("\n✅ AMC only exists in WKS_PG division");
        }
        
        const hmcInParent = await db.query<any>(`
            SELECT division_code, COUNT(*) as cnt
            FROM dbo.daftar_upah_aggregation_history
            WHERE gang_code = 'HMC' AND division_code != 'WKS_AR'
            GROUP BY division_code
        `);
        
        if (hmcInParent.length > 0) {
            console.log(`\n⚠️ HMC still appears in these divisions (should be removed):`);
            hmcInParent.forEach(row => {
                console.log(`  ${row.division_code}: ${row.cnt} records`);
            });
        } else {
            console.log("\n✅ HMC only exists in WKS_AR division");
        }
    } catch (error: any) {
        console.error(`❌ Failed to verify virtual gang separation: ${error.message}`);
    }
    
    console.log("\n=== FIX COMPLETE ===");
    console.log("\nNext steps:");
    console.log("1. Re-seed P1A division for 2/2026 (AMC should be excluded)");
    console.log("2. Investigate why B0720 and F0440 appear in multiple gangs");
    console.log("3. Verify PPh21 calculations after deduplication");
}

fixDuplicates().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
