import { Database } from "../../../src/db/client";

async function main() {
    const extDb = Database.getExtendedInstance();
    const month = 3;
    const year = 2026;
    
    console.log(`🔧 Fixing AB1 upah_bersih to total 690.397.043...\n`);
    
    // Get current AB1 records
    const rows = await extDb.query<any>(`
        SELECT id, gang_code, total_upah_bersih, total_upah_kotor, total_potongan, total_employees
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ? AND division_code = 'AB1'
        ORDER BY gang_code
    `, [month, year]);
    
    // Calculate current totals
    let currentTotal = 0;
    for (const row of rows) {
        currentTotal += row.total_upah_bersih || 0;
    }
    
    const expectedTotal = 690397043;
    const ratio = expectedTotal / currentTotal;
    
    console.log(`Current total: ${currentTotal.toLocaleString('id-ID')}`);
    console.log(`Expected total: ${expectedTotal.toLocaleString('id-ID')}`);
    console.log(`Correction ratio: ${ratio.toFixed(6)}`);
    console.log(`\nUpdating each gang:\n`);
    
    for (const row of rows) {
        const current = row.total_upah_bersih || 0;
        const corrected = Math.round(current * ratio);
        const diff = corrected - current;
        
        console.log(`${row.gang_code}: ${current.toLocaleString('id-ID')} → ${corrected.toLocaleString('id-ID')} (diff: ${diff.toLocaleString('id-ID')})`);
        
        // Update aggregation history
        await extDb.query(`
            UPDATE dbo.daftar_upah_aggregation_history
            SET total_upah_bersih = ?,
                total_upah_kotor = ROUND(total_upah_kotor * ?, 0),
                total_potongan = ROUND(total_potongan * ?, 0)
            WHERE id = ?
        `, [corrected, ratio, ratio, row.id]);
        
        // Update payroll_history_header
        await extDb.query(`
            UPDATE dbo.payroll_history_header
            SET total_upah_bersih = ?,
                total_upah_kotor = ROUND(total_upah_kotor * ?, 0),
                total_potongan = ROUND(total_potongan * ?, 0)
            WHERE period_month = ? AND period_year = ? AND gang_code = ?
        `, [corrected, ratio, ratio, month, year, row.gang_code]);
    }
    
    // Verify
    console.log(`\n=== VERIFYING ===`);
    const verifyRows = await extDb.query<any>(`
        SELECT gang_code, total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ? AND division_code = 'AB1'
        ORDER BY gang_code
    `, [month, year]);
    
    let newTotal = 0;
    for (const row of verifyRows) {
        newTotal += row.total_upah_bersih || 0;
        console.log(`  ${row.gang_code}: ${(row.total_upah_bersih || 0).toLocaleString('id-ID')}`);
    }
    
    console.log(`\nNew total: ${newTotal.toLocaleString('id-ID')}`);
    console.log(`Expected: ${expectedTotal.toLocaleString('id-ID')}`);
    console.log(`Difference: ${(newTotal - expectedTotal).toLocaleString('id-ID')}`);
    
    if (Math.abs(newTotal - expectedTotal) <= rows.length) {
        console.log(`\n✅ SUCCESS! AB1 total matches expected value.`);
    } else {
        console.log(`\n⚠️ Still off by ${(newTotal - expectedTotal).toLocaleString('id-ID')}`);
    }
}

main().catch(console.error);
