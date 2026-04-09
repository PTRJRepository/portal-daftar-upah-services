/**
 * Check ALL HR-related tables for duplicates
 * Including: history_hr_employee, history_hr_gang, and source tables
 */
import { Database } from "./backend/src/db/client";

async function checkAllHRDuplicates() {
    console.log("=== CHECKING ALL HR TABLES FOR DUPLICATES ===\n");

    const db = Database.getExtendedInstance();

    // 1. Check history_hr_employee (if exists)
    console.log("--- 1. Checking if history_hr_employee table exists ---");
    try {
        const tableExists = await db.query<any>(`
            SELECT * FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'history_hr_employee'
        `);
        
        if (tableExists.length > 0) {
            console.log("✅ history_hr_employee table exists\n");
            
            // Check for duplicates (same emp_code or nik)
            const empDuplicates = await db.query<any>(`
                SELECT TOP 20
                    emp_code,
                    COUNT(*) as dup_count,
                    STRING_AGG(CAST(id AS VARCHAR), ', ') WITHIN GROUP (ORDER BY id) as ids
                FROM dbo.history_hr_employee
                GROUP BY emp_code
                HAVING COUNT(*) > 1
                ORDER BY dup_count DESC
            `);

            if (empDuplicates.length > 0) {
                console.log(`⚠️ Found ${empDuplicates.length} duplicate employee codes:\n`);
                empDuplicates.forEach(e => {
                    console.log(`  ${e.emp_code}: ${e.dup_count} records [IDs: ${e.ids}]`);
                });
            } else {
                console.log("✅ No duplicate emp_code in history_hr_employee\n");
            }

            // Check by NIK
            const nikDuplicates = await db.query<any>(`
                SELECT TOP 20
                    nik,
                    COUNT(*) as dup_count
                FROM dbo.history_hr_employee
                WHERE nik IS NOT NULL
                GROUP BY nik
                HAVING COUNT(*) > 1
                ORDER BY dup_count DESC
            `);

            if (nikDuplicates.length > 0) {
                console.log(`\n⚠️ Found ${nikDuplicates.length} duplicate NIKs:\n`);
                nikDuplicates.forEach(n => {
                    console.log(`  ${n.nik}: ${n.dup_count} records`);
                });
            } else {
                console.log("✅ No duplicate NIK in history_hr_employee\n");
            }

        } else {
            console.log("❌ history_hr_employee table does NOT exist\n");
        }
    } catch (err) {
        console.log("❌ Error checking history_hr_employee:", err, "\n");
    }

    // 2. Check source tables for duplicates (HR_GANGLN, HR_EMPLOYEE, etc.)
    console.log("\n--- 2. Checking HR_GANGLN for duplicates ---");
    try {
        const dbVenus = Database.getVenusInstance();
        
        const gangDuplicates = await dbVenus.query<any>(`
            SELECT TOP 20
                GangCode,
                GangMember,
                COUNT(*) as dup_count
            FROM HR_GANGLN
            GROUP BY GangCode, GangMember
            HAVING COUNT(*) > 1
            ORDER BY dup_count DESC
        `);

        if (gangDuplicates.length > 0) {
            console.log(`⚠️ Found ${gangDuplicates.length} duplicate gang member entries in HR_GANGLN:\n`);
            gangDuplicates.slice(0, 10).forEach(g => {
                console.log(`  Gang: ${g.GangCode}, Member: ${g.GangMember}: ${g.dup_count}x`);
            });
        } else {
            console.log("✅ No duplicates in HR_GANGLN\n");
        }
    } catch (err) {
        console.log("❌ Error checking HR_GANGLN:", err, "\n");
    }

    // 3. Check payroll_history_detail for duplicates
    console.log("\n--- 3. Checking payroll_history_detail for duplicates ---");
    const detailDupes = await db.query<any>(`
        SELECT TOP 20
            d.emp_code,
            h.period_month,
            h.period_year,
            h.division_code,
            h.gang_code,
            COUNT(*) as dup_count,
            STRING_AGG(CAST(d.id AS VARCHAR), ', ') WITHIN GROUP (ORDER BY d.id) as ids
        FROM dbo.payroll_history_detail d
        INNER JOIN dbo.payroll_history_header h ON d.master_id = h.id
        GROUP BY d.emp_code, h.period_month, h.period_year, h.division_code, h.gang_code
        HAVING COUNT(*) > 1
        ORDER BY dup_count DESC
    `);

    if (detailDupes.length > 0) {
        console.log(`⚠️ Found ${detailDupes.length} duplicate detail entries:\n`);
        detailDupes.forEach(d => {
            console.log(`  ${d.emp_code} | ${d.period_month}/${d.period_year} | ${d.division_code}/${d.gang_code}: ${d.dup_count}x [IDs: ${d.ids}]`);
        });
    } else {
        console.log("✅ No duplicates in payroll_history_detail\n");
    }

    // 4. Check if same employee appears in multiple gangs in history
    console.log("\n--- 4. Checking for duplicate headers (same period/division/gang) ---");
    const headerDupes = await db.query<any>(`
        SELECT 
            period_month,
            period_year,
            division_code,
            gang_code,
            COUNT(*) as dup_count,
            STRING_AGG(CAST(id AS VARCHAR) + ' (created: ' + CAST(created_at AS VARCHAR(20)) + ')', ', ') WITHIN GROUP (ORDER BY id) as ids
        FROM dbo.payroll_history_header
        GROUP BY period_month, period_year, division_code, gang_code
        HAVING COUNT(*) > 1
        ORDER BY dup_count DESC
    `);

    if (headerDupes.length > 0) {
        console.log(`⚠️ Found ${headerDupes.length} duplicate headers:\n`);
        headerDupes.slice(0, 10).forEach(h => {
            console.log(`  ${h.period_month}/${h.period_year} - ${h.division_code}/${h.gang_code}: ${h.dup_count}x`);
            console.log(`    ${h.ids}\n`);
        });
    } else {
        console.log("✅ No duplicate headers found\n");
    }

    // 5. Final summary
    console.log("\n--- 5. FINAL SUMMARY ---");
    const counts = await Promise.all([
        db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.payroll_history_header", []),
        db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.payroll_history_detail", []),
        db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.history_gang_member", []),
    ]);

    console.log(`  payroll_history_header: ${counts[0]?.cnt || 0} records`);
    console.log(`  payroll_history_detail: ${counts[1]?.cnt || 0} records`);
    console.log(`  history_gang_member: ${counts[2]?.cnt || 0} records`);

    console.log("\n=== CHECK COMPLETE ===");
}

checkAllHRDuplicates().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
