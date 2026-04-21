/**
 * Find ALL duplicates in payroll history and HR tables
 * Check: payroll_history_header, payroll_history_detail, history_gang_member, history_hr_employee
 */
import { Database } from "./backend/src/db/client";

async function findAllDuplicates() {
    console.log("=== CHECKING ALL DUPLICATES (PAYROLL + HR) ===\n");

    const db = Database.getExtendedInstance();

    // 1. Check payroll_history_header for duplicates (same employee in same period)
    console.log("--- 1. Checking payroll_history_header for duplicates ---");
    const headerDuplicates = await db.query<any>(`
        SELECT 
            period_month,
            period_year,
            division_code,
            gang_code,
            COUNT(*) as dup_count
        FROM dbo.payroll_history_header
        GROUP BY period_month, period_year, division_code, gang_code
        HAVING COUNT(*) > 1
        ORDER BY dup_count DESC
    `);

    if (headerDuplicates.length > 0) {
        console.log(`⚠️ Found ${headerDuplicates.length} duplicate header combinations\n`);
        headerDuplicates.slice(0, 10).forEach(h => {
            console.log(`  ${h.period_month}/${h.period_year} - ${h.division_code}/${h.gang_code}: ${h.dup_count} records`);
        });
    } else {
        console.log("✅ No header duplicates found\n");
    }

    // 2. Check history_gang_member for duplicates (same emp_code in same period/gang)
    console.log("--- 2. Checking history_gang_member for duplicates ---");
    const gangDuplicates = await db.query<any>(`
        SELECT 
            emp_code,
            emp_name,
            period_month,
            period_year,
            division_code,
            gang_code,
            COUNT(*) as dup_count,
            STRING_AGG(CAST(id AS VARCHAR), ', ') WITHIN GROUP (ORDER BY id) as ids
        FROM dbo.history_gang_member
        GROUP BY emp_code, emp_name, period_month, period_year, division_code, gang_code
        HAVING COUNT(*) > 1
        ORDER BY dup_count DESC
    `);

    if (gangDuplicates.length > 0) {
        console.log(`⚠️ Found ${gangDuplicates.length} duplicate gang member records\n`);
        gangDuplicates.slice(0, 15).forEach(g => {
            console.log(`  ${g.emp_code} - ${g.emp_name} | ${g.period_month}/${g.period_year} | ${g.division_code}/${g.gang_code}: ${g.dup_count}x [IDs: ${g.ids}]`);
        });
    } else {
        console.log("✅ No gang member duplicates found\n");
    }

    // 3. Check if same employee appears in MULTIPLE gangs within same period
    console.log("--- 3. Checking employees in MULTIPLE gangs (same period) ---");
    const multiGangEmps = await db.query<any>(`
        SELECT 
            emp_code,
            emp_name,
            period_month,
            period_year,
            COUNT(DISTINCT gang_code) as gang_count,
            COUNT(*) as total_records,
            STRING_AGG(gang_code, ', ') WITHIN GROUP (ORDER BY gang_code) as gangs
        FROM dbo.history_gang_member
        GROUP BY emp_code, emp_name, period_month, period_year
        HAVING COUNT(DISTINCT gang_code) > 1
        ORDER BY total_records DESC, period_year DESC, period_month DESC
    `);

    if (multiGangEmps.length > 0) {
        console.log(`⚠️ Found ${multiGangEmps.length} employees in multiple gangs\n`);
        multiGangEmps.slice(0, 20).forEach(e => {
            console.log(`  ${e.emp_code} - ${e.emp_name} | ${e.period_month}/${e.period_year}: ${e.gang_count} gangs, ${e.total_records} records [${e.gangs}]`);
        });
    } else {
        console.log("✅ No multi-gang employees found\n");
    }

    // 4. Check payroll_history_detail for duplicates (same emp_code in same period)
    console.log("\n--- 4. Checking payroll_history_detail for duplicates ---");
    const detailDuplicates = await db.query<any>(`
        SELECT TOP 20
            d.emp_code,
            d.emp_name,
            h.period_month,
            h.period_year,
            h.division_code,
            h.gang_code,
            COUNT(*) as dup_count,
            STRING_AGG(CAST(d.id AS VARCHAR), ', ') WITHIN GROUP (ORDER BY d.id) as detail_ids
        FROM dbo.payroll_history_detail d
        JOIN dbo.payroll_history_header h ON d.master_id = h.id
        GROUP BY d.emp_code, d.emp_name, h.period_month, h.period_year, h.division_code, h.gang_code
        HAVING COUNT(*) > 1
        ORDER BY dup_count DESC
    `);

    if (detailDuplicates.length > 0) {
        console.log(`⚠️ Found ${detailDuplicates.length} duplicate detail records\n`);
        detailDuplicates.forEach(d => {
            console.log(`  ${d.emp_code} - ${d.emp_name} | ${d.period_month}/${d.period_year} | ${d.division_code}/${d.gang_code}: ${d.dup_count}x [IDs: ${d.detail_ids}]`);
        });
    } else {
        console.log("✅ No detail duplicates found\n");
    }

    // 5. Summary: Total counts per table
    console.log("\n--- 5. Summary counts ---");
    const headerCount = await db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.payroll_history_header", []);
    const detailCount = await db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.payroll_history_detail", []);
    const gangCount = await db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.history_gang_member", []);
    
    console.log(`  payroll_history_header: ${headerCount?.cnt || 0} records`);
    console.log(`  payroll_history_detail: ${detailCount?.cnt || 0} records`);
    console.log(`  history_gang_member: ${gangCount?.cnt || 0} records`);

    console.log("\n=== CHECK COMPLETE ===");
}

findAllDuplicates().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
