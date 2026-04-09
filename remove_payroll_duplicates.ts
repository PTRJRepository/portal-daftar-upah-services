/**
 * Find and remove duplicate payroll history data
 * Focuses on payroll_history_header and payroll_history_detail tables
 * Duplicates are identified by same period (month/year), division, and gang
 */
import { Database } from "./backend/src/db/client";

async function findAndRemovePayrollDuplicates() {
    console.log("=== FINDING AND REMOVING PAYROLL HISTORY DUPLICATES ===\n");

    const db = Database.getExtendedInstance();

    // Step 1: Find duplicate headers (same period + division + gang)
    console.log("--- Step 1: Finding duplicate payroll_history_header records ---");
    
    const duplicateHeaders = await db.query<any>(`
        SELECT 
            period_month,
            period_year,
            division_code,
            gang_code,
            COUNT(*) as dup_count,
            STRING_AGG(CAST(id AS VARCHAR) + ' (' + CAST(created_at AS VARCHAR) + ')', ', ') WITHIN GROUP (ORDER BY id) as ids
        FROM dbo.payroll_history_header
        GROUP BY period_month, period_year, division_code, gang_code
        HAVING COUNT(*) > 1
        ORDER BY dup_count DESC, period_year DESC, period_month DESC
    `);

    if (duplicateHeaders.length === 0) {
        console.log("✅ No duplicate headers found\n");
    } else {
        console.log(`⚠️ Found ${duplicateHeaders.length} duplicate header combinations:\n`);
        
        let totalDuplicatesRemoved = 0;
        
        for (const dup of duplicateHeaders) {
            console.log(`  ${dup.period_month}/${dup.period_year} - ${dup.division_code}/${dup.gang_code}: ${dup.dup_count} duplicates`);
            console.log(`    IDs: ${dup.ids}\n`);

            // Find the latest record (keep this one)
            const latestRecord = await db.queryOne<any>(`
                SELECT TOP 1 id, created_at
                FROM dbo.payroll_history_header
                WHERE period_month = ? 
                  AND period_year = ? 
                  AND division_code = ? 
                  AND gang_code = ?
                ORDER BY created_at DESC, id DESC
            `, [dup.period_month, dup.period_year, dup.division_code, dup.gang_code]);

            if (latestRecord) {
                console.log(`    ✓ Keeping latest: ID ${latestRecord.id} (created: ${latestRecord.created_at})`);

                // Find duplicates to delete (older records)
                const duplicatesToDelete = await db.query<any>(`
                    SELECT id
                    FROM dbo.payroll_history_header
                    WHERE period_month = ? 
                      AND period_year = ? 
                      AND division_code = ? 
                      AND gang_code = ?
                      AND id != ?
                    ORDER BY created_at ASC
                `, [dup.period_month, dup.period_year, dup.division_code, dup.gang_code, latestRecord.id]);

                console.log(`    🗑️ Will delete ${duplicatesToDelete.length} older record(s)\n`);

                // Delete detail records first (foreign key constraint)
                for (const dupHeader of duplicatesToDelete) {
                    const detailCount = await db.queryOne<any>(`
                        SELECT COUNT(*) as cnt
                        FROM dbo.payroll_history_detail
                        WHERE master_id = ?
                    `, [dupHeader.id]);

                    if (detailCount && detailCount.cnt > 0) {
                        await db.query(`
                            DELETE FROM dbo.payroll_history_detail
                            WHERE master_id = ?
                        `, [dupHeader.id]);
                        console.log(`      Deleted ${detailCount.cnt} detail record(s) for header ID ${dupHeader.id}`);
                    }

                    // Delete the duplicate header
                    await db.query(`
                        DELETE FROM dbo.payroll_history_header
                        WHERE id = ?
                    `, [dupHeader.id]);
                    console.log(`      Deleted duplicate header ID ${dupHeader.id}`);
                    
                    totalDuplicatesRemoved++;
                }
            }
        }
        
        console.log(`\n✅ Removed ${totalDuplicatesRemoved} duplicate header(s) and associated detail(s)\n`);
    }

    // Step 2: Check for orphaned detail records (no matching header)
    console.log("--- Step 2: Checking for orphaned detail records ---");
    
    const orphanedDetails = await db.query<any>(`
        SELECT COUNT(*) as cnt
        FROM dbo.payroll_history_detail d
        LEFT JOIN dbo.payroll_history_header h ON d.master_id = h.id
        WHERE h.id IS NULL
    `);

    if (orphanedDetails[0] && orphanedDetails[0].cnt > 0) {
        console.log(`⚠️ Found ${orphanedDetails[0].cnt} orphaned detail record(s)`);
        
        const deleteResult = await db.query(`
            DELETE d
            FROM dbo.payroll_history_detail d
            LEFT JOIN dbo.payroll_history_header h ON d.master_id = h.id
            WHERE h.id IS NULL
        `);
        
        console.log(`✅ Deleted ${orphanedDetails[0].cnt} orphaned detail record(s)\n`);
    } else {
        console.log("✅ No orphaned details found\n");
    }

    // Step 3: Show summary of remaining data
    console.log("--- Step 3: Summary of payroll history data ---");
    
    const summary = await db.query<any>(`
        SELECT 
            period_year,
            period_month,
            COUNT(*) as header_count,
            SUM(total_employees) as total_employees,
            SUM(total_upah_kotor) as total_upah_kotor,
            SUM(total_upah_bersih) as total_upah_bersih
        FROM dbo.payroll_history_header
        GROUP BY period_year, period_month
        ORDER BY period_year DESC, period_month DESC
    `);

    if (summary.length > 0) {
        console.log("\nPeriod Summary:");
        console.log("  Year | Month | Headers | Employees | Upah Kotor | Upah Bersih");
        console.log("  " + "-".repeat(80));
        summary.forEach(row => {
            console.log(`  ${row.period_year}    | ${row.period_month.toString().padStart(2, '0')}     | ${row.header_count.toString().padStart(7)} | ${row.total_employees.toString().padStart(9)} | ${Number(row.total_upah_kotor).toLocaleString('id-ID').padStart(12)} | ${Number(row.total_upah_bersih).toLocaleString('id-ID').padStart(12)}`);
        });
    } else {
        console.log("No payroll history data found");
    }

    console.log("\n=== CLEANUP COMPLETE ===");
}

findAndRemovePayrollDuplicates().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
