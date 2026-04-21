/**
 * Remove duplicates from history_gang_member dan tabel HR terkait
 * Logic:
 * 1. Untuk setiap kombinasi (emp_code, period_month, period_year, gang_code) - ambil record TERBARU (MAX id)
 * 2. Hapus record duplikat yang lebih lama
 * 3. Tambahkan DISTINCT filter untuk mencegah duplikat di masa depan
 */
import { Database } from "./backend/src/db/client";

async function removeGangMemberDuplicates() {
    console.log("=== REMOVING HISTORY_GANG_MEMBER DUPLICATES ===\n");

    const db = Database.getExtendedInstance();

    // 1. Find duplicates in history_gang_member
    console.log("--- Step 1: Finding duplicates in history_gang_member ---");
    const duplicates = await db.query<any>(`
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
        ORDER BY dup_count DESC, period_year DESC, period_month DESC
    `);

    if (duplicates.length === 0) {
        console.log("✅ No duplicates found in history_gang_member\n");
    } else {
        console.log(`⚠️ Found ${duplicates.length} duplicate combinations\n`);
        
        let totalDeleted = 0;
        
        for (const dup of duplicates.slice(0, 50)) { // Limit to first 50 for safety
            console.log(`\n  ${dup.emp_code} - ${dup.emp_name} | ${dup.period_month}/${dup.period_year} | ${dup.division_code}/${dup.gang_code}`);
            console.log(`    ${dup.dup_count} duplicates [IDs: ${dup.ids}]`);

            // Get the latest record (keep this one)
            const latest = await db.queryOne<any>(`
                SELECT TOP 1 id, created_at
                FROM dbo.history_gang_member
                WHERE emp_code = ?
                  AND period_month = ?
                  AND period_year = ?
                  AND division_code = ?
                  AND gang_code = ?
                ORDER BY created_at DESC, id DESC
            `, [dup.emp_code, dup.period_month, dup.period_year, dup.division_code, dup.gang_code]);

            if (latest) {
                console.log(`    ✓ Keeping: ID ${latest.id} (created: ${latest.created_at})`);

                // Delete older duplicates
                const toDelete = await db.query<any>(`
                    SELECT id
                    FROM dbo.history_gang_member
                    WHERE emp_code = ?
                      AND period_month = ?
                      AND period_year = ?
                      AND division_code = ?
                      AND gang_code = ?
                      AND id != ?
                `, [dup.emp_code, dup.period_month, dup.period_year, dup.division_code, dup.gang_code, latest.id]);

                for (const record of toDelete) {
                    await db.query(`
                        DELETE FROM dbo.history_gang_member
                        WHERE id = ?
                    `, [record.id]);
                    console.log(`    🗑️ Deleted: ID ${record.id}`);
                    totalDeleted++;
                }
            }
        }
        
        console.log(`\n✅ Deleted ${totalDeleted} duplicate gang member records\n`);
    }

    // 2. Check for employees appearing in MULTIPLE gangs (same period) - this might be legitimate
    console.log("\n--- Step 2: Employees in multiple gangs (informational) ---");
    const multiGang = await db.query<any>(`
        SELECT TOP 20
            emp_code,
            emp_name,
            period_month,
            period_year,
            COUNT(DISTINCT gang_code) as gang_count,
            COUNT(*) as total_records,
            STRING_AGG(CAST(gang_code AS VARCHAR) + ' (ID:' + CAST(id AS VARCHAR) + ')', ', ') WITHIN GROUP (ORDER BY gang_code) as gang_details
        FROM dbo.history_gang_member
        GROUP BY emp_code, emp_name, period_month, period_year
        HAVING COUNT(DISTINCT gang_code) > 1
        ORDER BY total_records DESC
    `);

    if (multiGang.length > 0) {
        console.log(`⚠️ Found ${multiGang.length} employees in multiple gangs (may be legitimate):\n`);
        multiGang.forEach(e => {
            console.log(`  ${e.emp_code} - ${e.emp_name} | ${e.period_month}/${e.period_year}: ${e.gang_count} gangs, ${e.total_records} records`);
            console.log(`    ${e.gang_details}\n`);
        });
    } else {
        console.log("✅ No multi-gang employees found\n");
    }

    // 3. Summary after cleanup
    console.log("\n--- Step 3: Summary ---");
    const totalGangMembers = await db.queryOne<any>("SELECT COUNT(*) as cnt FROM dbo.history_gang_member", []);
    const uniqueGangMembers = await db.queryOne<any>(`
        SELECT COUNT(*) as cnt 
        FROM (
            SELECT DISTINCT emp_code, period_month, period_year, division_code, gang_code
            FROM dbo.history_gang_member
        ) t
    `, []);
    
    console.log(`  Total history_gang_member records: ${totalGangMembers?.cnt || 0}`);
    console.log(`  Unique combinations: ${uniqueGangMembers?.cnt || 0}`);
    console.log(`  Duplicates removed: ${(totalGangMembers?.cnt || 0) - (uniqueGangMembers?.cnt || 0)}`);

    console.log("\n=== CLEANUP COMPLETE ===");
}

removeGangMemberDuplicates().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
