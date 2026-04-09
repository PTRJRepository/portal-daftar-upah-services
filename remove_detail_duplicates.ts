/**
 * Remove duplicates from payroll_history_detail
 * Uses ID column to determine which to keep (highest ID = latest)
 */
import { Database } from "./backend/src/db/client";

async function removeDetailDuplicates() {
    console.log("=== REMOVING payroll_history_detail DUPLICATES ===\n");

    const db = Database.getExtendedInstance();

    // Get all duplicate combinations
    const allDupes = await db.query<any>(`
        SELECT 
            d.id as detail_id,
            d.emp_code,
            h.period_month,
            h.period_year,
            h.division_code,
            h.gang_code,
            d.id as rn
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
              AND d2.id > d.id
        )
        ORDER BY d.emp_code, h.period_year DESC, h.period_month DESC
    `);

    if (allDupes.length === 0) {
        console.log("✅ No duplicates found in payroll_history_detail\n");
        return;
    }

    console.log(`⚠️ Found ${allDupes.length} duplicate detail records\n`);
    console.log("Deleting duplicates (keeping record with highest ID for each combination)...\n");

    // Delete in batches to avoid timeout
    const batchSize = 100;
    let deleted = 0;
    
    for (let i = 0; i < allDupes.length; i += batchSize) {
        const batch = allDupes.slice(i, i + batchSize);
        const ids = batch.map(d => d.detail_id);
        
        const placeholders = ids.map(() => '?').join(',');
        await db.query(`
            DELETE FROM dbo.payroll_history_detail
            WHERE id IN (${placeholders})
        `, ids);
        
        deleted += batch.length;
        console.log(`  ✓ Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records (${deleted}/${allDupes.length})`);
    }

    console.log(`\n✅ Total deleted: ${deleted} duplicate detail records\n`);

    // Verify
    const remainingCount = await db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.payroll_history_detail", []);
    console.log(`  Remaining payroll_history_detail records: ${remainingCount?.cnt}`);
}

removeDetailDuplicates().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
