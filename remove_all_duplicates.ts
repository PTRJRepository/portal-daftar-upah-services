/**
 * REMOVE ALL DUPLICATES from HR and Payroll history tables
 * 
 * Tables to clean:
 * 1. history_hr_employee - Keep latest record per emp_code
 * 2. payroll_history_detail - Keep only one record per employee per period
 * 3. history_gang_member - Ensure DISTINCT
 */
import { Database } from "./backend/src/db/client";

async function removeAllDuplicates() {
    console.log("=== REMOVING ALL DUPLICATES FROM HR & PAYROLL TABLES ===\n");

    const db = Database.getExtendedInstance();
    let totalDeleted = 0;

    // ========================================
    // 1. Clean history_hr_employee
    // ========================================
    console.log("--- 1. Cleaning history_hr_employee ---");
    
    const empDuplicates = await db.query<any>(`
        SELECT emp_code, COUNT(*) as dup_count
        FROM dbo.history_hr_employee
        GROUP BY emp_code
        HAVING COUNT(*) > 1
        ORDER BY dup_count DESC
    `);

    if (empDuplicates.length > 0) {
        console.log(`Found ${empDuplicates.length} employee codes with duplicates\n`);
        
        for (const dup of empDuplicates) {
            // Get the latest record
            const latest = await db.queryOne<any>(`
                SELECT TOP 1 id, created_at
                FROM dbo.history_hr_employee
                WHERE emp_code = ?
                ORDER BY created_at DESC, id DESC
            `, [dup.emp_code]);

            if (latest) {
                // Delete older duplicates
                const toDelete = await db.query<any>(`
                    SELECT id
                    FROM dbo.history_hr_employee
                    WHERE emp_code = ? AND id != ?
                `, [dup.emp_code, latest.id]);

                for (const record of toDelete) {
                    await db.query(`DELETE FROM dbo.history_hr_employee WHERE id = ?`, [record.id]);
                }
                
                totalDeleted += toDelete.length;
                console.log(`  ✓ ${dup.emp_code}: Kept ID ${latest.id}, deleted ${toDelete.length} duplicate(s)`);
            }
        }
    } else {
        console.log("✅ No duplicates in history_hr_employee\n");
    }

    // ========================================
    // 2. Clean payroll_history_detail
    // ========================================
    console.log("\n--- 2. Cleaning payroll_history_detail ---");
    
    const detailDuplicates = await db.query<any>(`
        SELECT 
            d.id as detail_id,
            d.emp_code,
            h.id as header_id,
            h.period_month,
            h.period_year,
            h.division_code,
            h.gang_code,
            d.created_at
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
              AND (d2.id < d.id OR (d2.id = d.id AND d2.created_at < d.created_at))
        )
        ORDER BY d.emp_code, h.period_year DESC, h.period_month DESC
    `);

    if (detailDuplicates.length > 0) {
        console.log(`Found ${detailDuplicates.length} duplicate detail records\n`);
        
        for (const dup of detailDuplicates) {
            await db.query(`DELETE FROM dbo.payroll_history_detail WHERE id = ?`, [dup.detail_id]);
            totalDeleted++;
        }
        
        console.log(`  ✓ Deleted ${detailDuplicates.length} duplicate detail records`);
    } else {
        console.log("✅ No duplicates in payroll_history_detail\n");
    }

    // ========================================
    // 3. Add UNIQUE INDEX to prevent future duplicates
    // ========================================
    console.log("\n--- 3. Adding UNIQUE constraints to prevent future duplicates ---");
    
    try {
        // Add unique index on history_hr_employee
        await db.query(`
            IF NOT EXISTS (
                SELECT * FROM sys.indexes 
                WHERE name = 'UX_history_hr_employee_emp_code'
            )
            CREATE UNIQUE INDEX UX_history_hr_employee_emp_code 
            ON dbo.history_hr_employee(emp_code)
            WITH (IGNORE_DUP_KEY = ON)
        `);
        console.log("  ✓ Added unique index on history_hr_employee(emp_code)");
    } catch (err) {
        console.log("  ⚠️ Could not add unique index on history_hr_employee:", err);
    }

    // ========================================
    // 4. Final Summary
    // ========================================
    console.log("\n--- 4. FINAL SUMMARY ---");
    const counts = await Promise.all([
        db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.history_hr_employee", []),
        db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.payroll_history_detail", []),
        db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.history_gang_member", []),
        db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.payroll_history_header", []),
    ]);

    console.log(`  history_hr_employee: ${counts[0]?.cnt || 0} records`);
    console.log(`  payroll_history_detail: ${counts[1]?.cnt || 0} records`);
    console.log(`  history_gang_member: ${counts[2]?.cnt || 0} records`);
    console.log(`  payroll_history_header: ${counts[3]?.cnt || 0} records`);
    console.log(`\n  TOTAL DUPLICATES REMOVED: ${totalDeleted}`);

    console.log("\n=== CLEANUP COMPLETE ===");
}

removeAllDuplicates().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
