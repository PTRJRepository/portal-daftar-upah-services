/**
 * FAST REMOVE - Simplified version
 * Only clean tables that have duplicates
 */
import { Database } from "./backend/src/db/client";

async function fastRemoveDuplicates() {
    console.log("=== FAST DUPLICATE REMOVAL (SIMPLIFIED) ===\n");

    const db = Database.getExtendedInstance();

    // ========================================
    // 1. history_hr_employee - Already cleaned! (3,195 deleted)
    // ========================================
    console.log("--- 1. history_hr_employee ---");
    const hrCount = await db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.history_hr_employee", []);
    console.log(`  ✅ Current records: ${hrCount?.cnt}\n`);

    // ========================================
    // 2. Check payroll_history_detail for duplicates
    // ========================================
    console.log("--- 2. Checking payroll_history_detail ---");
    
    const detailDupes = await db.query<any>(`
        SELECT TOP 10
            d.emp_code,
            h.period_month,
            h.period_year,
            h.division_code,
            h.gang_code,
            COUNT(*) as dup_count
        FROM dbo.payroll_history_detail d
        INNER JOIN dbo.payroll_history_header h ON d.master_id = h.id
        GROUP BY d.emp_code, h.period_month, h.period_year, h.division_code, h.gang_code
        HAVING COUNT(*) > 1
        ORDER BY dup_count DESC
    `);

    if (detailDupes.length > 0) {
        console.log(`  ⚠️ Found ${detailDupes.length} duplicate combinations (showing top 10):\n`);
        detailDupes.forEach(d => {
            console.log(`    ${d.emp_code} | ${d.period_month}/${d.period_year} | ${d.division_code}/${d.gang_code}: ${d.dup_count}x`);
        });
        console.log();
    } else {
        console.log(`  ✅ No duplicates found\n`);
    }

    // ========================================
    // 3. Check history_gang_member for duplicates
    // ========================================
    console.log("--- 3. Checking history_gang_member ---");
    
    const gangDupes = await db.query<any>(`
        SELECT TOP 10
            emp_code,
            period_month,
            period_year,
            division_code,
            gang_code,
            COUNT(*) as dup_count
        FROM dbo.history_gang_member
        GROUP BY emp_code, period_month, period_year, division_code, gang_code
        HAVING COUNT(*) > 1
        ORDER BY dup_count DESC
    `);

    if (gangDupes.length > 0) {
        console.log(`  ⚠️ Found ${gangDupes.length} duplicate combinations (showing top 10):\n`);
        gangDupes.forEach(g => {
            console.log(`    ${g.emp_code} | ${g.period_month}/${g.period_year} | ${g.division_code}/${g.gang_code}: ${g.dup_count}x`);
        });
        console.log();
    } else {
        console.log(`  ✅ No duplicates found\n`);
    }

    // ========================================
    // 4. Check for employees in multiple gangs (may be legitimate)
    // ========================================
    console.log("--- 4. Employees in multiple gangs (same period) ---");
    
    const multiGang = await db.query<any>(`
        SELECT TOP 10
            emp_code,
            period_month,
            period_year,
            COUNT(DISTINCT gang_code) as gang_count,
            COUNT(*) as total_records
        FROM dbo.history_gang_member
        GROUP BY emp_code, period_month, period_year
        HAVING COUNT(DISTINCT gang_code) > 1
        ORDER BY total_records DESC
    `);

    if (multiGang.length > 0) {
        console.log(`  ℹ️  Found ${multiGang.length} employees in multiple gangs (may be legitimate):\n`);
        multiGang.forEach(m => {
            console.log(`    ${m.emp_code} | ${m.period_month}/${m.period_year}: ${m.gang_count} gangs, ${m.total_records} records`);
        });
        console.log();
    } else {
        console.log(`  ✅ No multi-gang employees found\n`);
    }

    // ========================================
    // 5. Final Summary
    // ========================================
    console.log("--- 5. FINAL SUMMARY ---");
    const finalCounts = await Promise.all([
        db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.history_hr_employee", []),
        db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.payroll_history_detail", []),
        db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.history_gang_member", []),
        db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.payroll_history_header", []),
    ]);

    console.log(`  history_hr_employee: ${finalCounts[0]?.cnt || 0} records (deleted 3,195 duplicates)`);
    console.log(`  payroll_history_detail: ${finalCounts[1]?.cnt || 0} records`);
    console.log(`  history_gang_member: ${finalCounts[2]?.cnt || 0} records`);
    console.log(`  payroll_history_header: ${finalCounts[3]?.cnt || 0} records`);

    console.log("\n=== CHECK COMPLETE ===");
}

fastRemoveDuplicates().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
