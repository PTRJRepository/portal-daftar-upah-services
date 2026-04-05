/**
 * Debug seeding process untuk C1M
 * Melihat step-by-step bagaimana data dihitung saat seeding
 */

import { PayrollDataService } from "../../../src/services/payrollDataService";
import { Database } from "../../../src/db/client";

async function main() {
    const gangCode = "C1M";
    const division = "P2A";
    const month = 3;
    const year = 2026;
    const authToken = "dummy";  // Not used in direct service call
    
    console.log(`=== DEBUGGING SEEDING PROCESS FOR ${gangCode} ===\n`);
    console.log(`Expected upah_bersih: 121.365.822\n`);
    
    // ===== STEP 1: Fetch raw data (what seeder gets) =====
    console.log("📦 STEP 1: Fetching raw payroll data (as seeder does)...");
    const payrollData = await PayrollDataService.fetchPayrollData(division, month, year, authToken);
    
    // Get C1M records
    const c1mRecords = payrollData['P2A']?.filter(r => r.gang_code === gangCode) || [];
    
    console.log(`  Found ${c1mRecords.length} record(s) for ${gangCode}\n`);
    
    if (c1mRecords.length > 0) {
        const record = c1mRecords[0];
        console.log(`  RECORD FROM SEEDER:`);
        console.log(`    gang_code: ${record.gang_code}`);
        console.log(`    total_employees: ${record.total_employees}`);
        console.log(`    total_upah_kotor: ${(record.total_upah_kotor || 0).toLocaleString('id-ID')}`);
        console.log(`    total_potongan: ${(record.total_potongan || 0).toLocaleString('id-ID')}`);
        console.log(`    total_upah_bersih: ${(record.total_upah_bersih || 0).toLocaleString('id-ID')}`);
        console.log(`    total_premi: ${(record.total_premi || 0).toLocaleString('id-ID')}`);
        console.log(`    total_premi_brondol: ${(record.total_premi_brondol || 0).toLocaleString('id-ID')}`);
    }
    
    // ===== STEP 2: Check what's in aggregation history NOW =====
    console.log(`\n📦 STEP 2: Checking current aggregation history...`);
    const extDb = Database.getExtendedInstance();
    
    const histRows = await extDb.query<any>(`
        SELECT id, gang_code, total_employees, total_upah_kotor, total_potongan, total_upah_bersih, created_at
        FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
        ORDER BY created_at DESC
    `, [month, year, gangCode]);
    
    console.log(`  Found ${histRows.length} history record(s):\n`);
    for (const row of histRows) {
        console.log(`  ID ${row.id}:`);
        console.log(`    employees: ${row.total_employees}`);
        console.log(`    upah_kotor: ${(row.total_upah_kotor || 0).toLocaleString('id-ID')}`);
        console.log(`    potongan: ${(row.total_potongan || 0).toLocaleString('id-ID')}`);
        console.log(`    upah_bersih: ${(row.total_upah_bersih || 0).toLocaleString('id-ID')}`);
        console.log(`    created: ${row.created_at}`);
        console.log();
    }
    
    // ===== STEP 3: Compare =====
    console.log(`\n📦 STEP 3: COMPARISON\n`);
    
    if (c1mRecords.length > 0 && histRows.length > 0) {
        const seeder = c1mRecords[0];
        const history = histRows[0];
        
        console.log(`  | Field | Seeder Output | History Stored | Difference |`);
        console.log(`  |-------|--------------|----------------|------------|`);
        console.log(`  | employees | ${seeder.total_employees} | ${history.total_employees} | ${seeder.total_employees - history.total_employees} |`);
        console.log(`  | upah_kotor | ${(seeder.total_upah_kotor || 0).toLocaleString('id-ID')} | ${(history.total_upah_kotor || 0).toLocaleString('id-ID')} | ${((seeder.total_upah_kotor || 0) - (history.total_upah_kotor || 0)).toLocaleString('id-ID')} |`);
        console.log(`  | potongan | ${(seeder.total_potongan || 0).toLocaleString('id-ID')} | ${(history.total_potongan || 0).toLocaleString('id-ID')} | ${((seeder.total_potongan || 0) - (history.total_potongan || 0)).toLocaleString('id-ID')} |`);
        console.log(`  | upah_bersih | ${(seeder.total_upah_bersih || 0).toLocaleString('id-ID')} | ${(history.total_upah_bersih || 0).toLocaleString('id-ID')} | ${((seeder.total_upah_bersih || 0) - (history.total_upah_bersih || 0)).toLocaleString('id-ID')} |`);
        
        const expected = 121365822;
        console.log(`\n  Expected: ${expected.toLocaleString('id-ID')}`);
        console.log(`  Seeder gives: ${(seeder.total_upah_bersih || 0).toLocaleString('id-ID')}`);
        console.log(`  History has: ${(history.total_upah_bersih || 0).toLocaleString('id-ID')}`);
    }
}

main().catch(console.error);
