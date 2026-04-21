/**
 * Compare PPh21 between Daftar Upah (aggregation) and Tax Report for ARA division
 */
import { Database } from "./backend/src/db/client";

async function comparePph21() {
    console.log("=== COMPARING PPh21: DAFTAR UPAH vs TAX REPORT (ARA Division) ===\n");
    
    const historyDb = Database.getExtendedInstance();
    
    // Check PPh21 from aggregation history for ARA
    console.log("--- PPh21 from Daftar Upah (Aggregation History) - ARA ---");
    const aggPph21 = await historyDb.query<any>(`
        SELECT 
            gang_code,
            gang_description,
            period_month,
            period_year,
            total_employees,
            total_pph21,
            total_upah_kotor,
            total_upah_bersih,
            total_gaji_pokok,
            total_tunjangan,
            total_lembur
        FROM dbo.daftar_upah_aggregation_history
        WHERE division_code = 'ARA' AND period_month = 2 AND period_year = 2026
        ORDER BY gang_code
    `);
    
    if (aggPph21.length > 0) {
        let totalPph21 = 0;
        console.log(`Found ${aggPph21.length} gangs in ARA for 2/2026:\n`);
        aggPph21.forEach(row => {
            console.log(`  ${row.gang_code} - ${row.gang_description}`);
            console.log(`    Employees: ${row.total_employees}`);
            console.log(`    PPh21: ${row.total_pph21?.toLocaleString('id-ID') || 0}`);
            console.log(`    Upah Kotor: ${row.total_upah_kotor?.toLocaleString('id-ID') || 0}`);
            console.log(`    Gaji Pokok: ${row.total_gaji_pokok?.toLocaleString('id-ID') || 0}`);
            console.log(`    Tunjangan: ${row.total_tunjangan?.toLocaleString('id-ID') || 0}`);
            console.log(`    Lembur: ${row.total_lembur?.toLocaleString('id-ID') || 0}\n`);
            totalPph21 += Number(row.total_pph21) || 0;
        });
        console.log(`\n💰 TOTAL PPh21 from Daftar Upah (ARA, 2/2026): ${totalPph21.toLocaleString('id-ID')}`);
    } else {
        console.log("⚠️ No aggregation data found for ARA in 2/2026");
    }
    
    // Check if there's F1BHL specifically
    console.log("\n--- Checking F1BHL specifically ---");
    const f1bhlData = await historyDb.query<any>(`
        SELECT 
            division_code,
            gang_code,
            gang_description,
            period_month,
            period_year,
            total_employees,
            total_pph21,
            total_upah_kotor,
            total_upah_bersih
        FROM dbo.daftar_upah_aggregation_history
        WHERE gang_code = 'F1BHL' AND period_month = 2 AND period_year = 2026
    `);
    
    if (f1bhlData.length > 0) {
        console.log(`F1BHL found:`);
        f1bhlData.forEach(row => {
            console.log(`  Division: ${row.division_code}, Gang: ${row.gang_code}`);
            console.log(`  Employees: ${row.total_employees}, PPh21: ${row.total_pph21}`);
        });
    } else {
        console.log("⚠️ F1BHL not found in aggregation history for 2/2026");
    }
    
    // Check all ARA gangs including F1BHL, F2H, F2M, etc.
    console.log("\n--- All ARA gangs in aggregation (any period 2/2026) ---");
    const allAraGangs = await historyDb.query<any>(`
        SELECT 
            division_code,
            gang_code,
            gang_description,
            period_month,
            period_year,
            total_employees,
            total_pph21
        FROM dbo.daftar_upah_aggregation_history
        WHERE (division_code = 'ARA' OR gang_code LIKE 'F%') AND period_month = 2 AND period_year = 2026
        ORDER BY division_code, gang_code
    `);
    
    if (allAraGangs.length > 0) {
        console.log(`Found ${allAraGangs.length} records:\n`);
        allAraGangs.forEach(row => {
            console.log(`  ${row.division_code}/${row.gang_code} - ${row.gang_description}`);
            console.log(`    Employees: ${row.total_employees}, PPh21: ${row.total_pph21}\n`);
        });
    } else {
        console.log("⚠️ No ARA gangs found in aggregation for 2/2026");
    }
    
    console.log("\n=== COMPARISON COMPLETE ===");
    console.log("\nNext: Check Tax Report Service calculation for ARA");
}

comparePph21().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
