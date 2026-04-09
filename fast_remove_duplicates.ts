/**
 * FAST REMOVE DUPLICATES using SQL DELETE queries directly
 * Much faster than looping through each duplicate
 */
import { Database } from "./backend/src/db/client";

async function fastRemoveDuplicates() {
    console.log("=== FAST DUPLICATE REMOVAL (SQL DIRECT) ===\n");

    const db = Database.getExtendedInstance();

    // ========================================
    // 1. Remove duplicates from history_hr_employee
    // ========================================
    console.log("--- 1. Removing duplicates from history_hr_employee ---");
    
    // Check count before
    const beforeCount = await db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.history_hr_employee", []);
    console.log(`  Records before: ${beforeCount?.cnt}`);

    // Delete duplicates - keep only the latest record per emp_code
    const deleteResult = await db.query(`
        WITH CTE AS (
            SELECT 
                id,
                emp_code,
                ROW_NUMBER() OVER (
                    PARTITION BY emp_code 
                    ORDER BY created_at DESC, id DESC
                ) as rn
            FROM dbo.history_hr_employee
        )
        DELETE FROM CTE WHERE rn > 1
    `);

    // Check count after
    const afterCount = await db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.history_hr_employee", []);
    console.log(`  Records after: ${afterCount?.cnt}`);
    console.log(`  ✅ Deleted: ${beforeCount!.cnt - afterCount!.cnt} duplicates\n`);

    // ========================================
    // 2. Remove duplicates from payroll_history_detail
    // ========================================
    console.log("--- 2. Checking payroll_history_detail for duplicates ---");
    
    const detailDupes = await db.queryOne<any>(`
        SELECT COUNT(*) as cnt
        FROM (
            SELECT 
                d.emp_code,
                h.period_month,
                h.period_year,
                h.division_code,
                h.gang_code,
                ROW_NUMBER() OVER (
                    PARTITION BY d.emp_code, h.period_month, h.period_year, h.division_code, h.gang_code
                    ORDER BY d.created_at DESC, d.id DESC
                ) as rn
            FROM dbo.payroll_history_detail d
            INNER JOIN dbo.payroll_history_header h ON d.master_id = h.id
        ) t
        WHERE rn > 1
    `, []);

    if (detailDupes && detailDupes.cnt > 0) {
        console.log(`  Found ${detailDupes.cnt} duplicate detail records`);
        
        await db.query(`
            WITH CTE AS (
                SELECT d.id
                FROM dbo.payroll_history_detail d
                INNER JOIN dbo.payroll_history_header h ON d.master_id = h.id
                WHERE EXISTS (
                    SELECT 1
                    FROM dbo.payroll_history_detail d2
                    INNER JOIN dbo.payroll_history_header h2 ON d2.master_id = h2.id
                    WHERE d2.emp_code = d.emp_code
                      AND h2.period_month = h.period_month
                      AND h2.period_year = h.period_year
                      AND h2.division_code = h.division_code
                      AND h2.gang_code = h.gang_code
                      AND (d2.created_at > d.created_at OR (d2.created_at = d.created_at AND d2.id > d.id))
                )
            )
            DELETE FROM dbo.payroll_history_detail
            WHERE id IN (SELECT id FROM CTE)
        `);
        
        console.log(`  ✅ Deleted ${detailDupes.cnt} duplicate detail records\n`);
    } else {
        console.log(`  ✅ No duplicates found\n`);
    }

    // ========================================
    // 3. Remove duplicates from history_gang_member
    // ========================================
    console.log("--- 3. Checking history_gang_member for duplicates ---");
    
    const gangDupes = await db.queryOne<any>(`
        SELECT COUNT(*) as cnt
        FROM (
            SELECT 
                emp_code,
                period_month,
                period_year,
                division_code,
                gang_code,
                ROW_NUMBER() OVER (
                    PARTITION BY emp_code, period_month, period_year, division_code, gang_code
                    ORDER BY created_at DESC, id DESC
                ) as rn
            FROM dbo.history_gang_member
        ) t
        WHERE rn > 1
    `, []);

    if (gangDupes && gangDupes.cnt > 0) {
        console.log(`  Found ${gangDupes.cnt} duplicate gang member records`);
        
        await db.query(`
            WITH CTE AS (
                SELECT id
                FROM (
                    SELECT 
                        id,
                        ROW_NUMBER() OVER (
                            PARTITION BY emp_code, period_month, period_year, division_code, gang_code
                            ORDER BY created_at DESC, id DESC
                        ) as rn
                    FROM dbo.history_gang_member
                ) t
                WHERE rn > 1
            )
            DELETE FROM dbo.history_gang_member
            WHERE id IN (SELECT id FROM CTE)
        `);
        
        console.log(`  ✅ Deleted ${gangDupes.cnt} duplicate gang member records\n`);
    } else {
        console.log(`  ✅ No duplicates found\n`);
    }

    // ========================================
    // 4. Final Summary
    // ========================================
    console.log("--- 4. FINAL SUMMARY ---");
    const finalCounts = await Promise.all([
        db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.history_hr_employee", []),
        db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.payroll_history_detail", []),
        db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.history_gang_member", []),
        db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.payroll_history_header", []),
    ]);

    console.log(`  history_hr_employee: ${finalCounts[0]?.cnt || 0} records`);
    console.log(`  payroll_history_detail: ${finalCounts[1]?.cnt || 0} records`);
    console.log(`  history_gang_member: ${finalCounts[2]?.cnt || 0} records`);
    console.log(`  payroll_history_header: ${finalCounts[3]?.cnt || 0} records`);

    console.log("\n=== CLEANUP COMPLETE ===");
}

fastRemoveDuplicates().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
