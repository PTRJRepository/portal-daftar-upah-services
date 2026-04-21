/**
 * Compare PPh21 between Tax Report API response and Daftar Upah aggregation for ARA
 */
import { Database } from "./backend/src/db/client";
import { taxReportService } from "./backend/src/services/taxReportService";

async function comparePph21Detailed() {
    console.log("=== DETAILED PPh21 COMPARISON: Tax Report vs Daftar Upah (ARA) ===\n");
    
    const historyDb = Database.getExtendedInstance();
    
    // Get data from aggregation (Daftar Upah)
    console.log("--- Step 1: Get PPh21 from Daftar Upah (Aggregation) for ARA, 2/2026 ---");
    const aggData = await historyDb.query<any>(`
        SELECT 
            gang_code,
            gang_description,
            total_employees,
            total_pph21,
            total_upah_kotor,
            total_gaji_pokok,
            total_tunjangan,
            total_lembur,
            dynamic_premi_data
        FROM dbo.daftar_upah_aggregation_history
        WHERE division_code = 'ARA' AND period_month = 2 AND period_year = 2026
        ORDER BY gang_code
    `);
    
    let aggTotalPph21 = 0;
    let aggTotalEmployees = 0;
    console.log("\nDaftar Upah (Aggregation) Data:\n");
    aggData.forEach(row => {
        const pph21 = Number(row.total_pph21) || 0;
        const emps = Number(row.total_employees) || 0;
        aggTotalPph21 += pph21;
        aggTotalEmployees += emps;
        console.log(`  ${row.gang_code} (${row.gang_description})`);
        console.log(`    Employees: ${emps}, PPh21: ${pph21.toLocaleString('id-ID')}`);
        console.log(`    Upah Kotor: ${(Number(row.total_upah_kotor)||0).toLocaleString('id-ID')}`);
    });
    console.log(`\n📊 AGGREGATION TOTALS:`);
    console.log(`   Employees: ${aggTotalEmployees}`);
    console.log(`   PPh21 Total: ${aggTotalPph21.toLocaleString('id-ID')}\n`);
    
    // Get employee-level data from Tax Report
    console.log("--- Step 2: Get PPh21 from Tax Report for ARA, 2/2026 ---");
    console.log("   (Calling taxReportService.getMonthlyTaxReport...)\n");
    
    try {
        const taxReportResult = await taxReportService.getMonthlyTaxReport(2026, 2, 'ARA', undefined, undefined, false);
        
        if (taxReportResult && taxReportResult.employees) {
            const employees = taxReportResult.employees;
            let taxTotalPph21 = 0;
            
            console.log(`Tax Report Data (${employees.length} employees):\n`);
            
            // Group by gang
            const gangPph21 = new Map<string, { count: number, pph21: number }>();
            
            employees.forEach((emp: any) => {
                const pph21 = Number(emp.pph21_ter) || Number(emp.pph21) || 0;
                const gang = emp.gang_code || 'UNKNOWN';
                taxTotalPph21 += pph21;
                
                if (!gangPph21.has(gang)) {
                    gangPph21.set(gang, { count: 0, pph21: 0 });
                }
                const gangData = gangPph21.get(gang)!;
                gangData.count++;
                gangData.pph21 += pph21;
            });
            
            console.log("By Gang:\n");
            gangPph21.forEach((data, gang) => {
                console.log(`  ${gang}: ${data.count} employees, PPh21: ${data.pph21.toLocaleString('id-ID')}`);
            });
            
            console.log(`\n📊 TAX REPORT TOTALS:`);
            console.log(`   Employees: ${employees.length}`);
            console.log(`   PPh21 Total: ${taxTotalPph21.toLocaleString('id-ID')}\n`);
            
            // Compare
            console.log("--- Step 3: COMPARISON ---\n");
            const diff = taxTotalPph21 - aggTotalPph21;
            const diffPercent = aggTotalPph21 > 0 ? (diff / aggTotalPph21 * 100).toFixed(2) : 0;
            
            console.log(`Daftar Upah (Aggregation): ${aggTotalPph21.toLocaleString('id-ID')} (${aggTotalEmployees} employees)`);
            console.log(`Tax Report:                ${taxTotalPph21.toLocaleString('id-ID')} (${employees.length} employees)`);
            console.log(`\nDifference: ${diff.toLocaleString('id-ID')} (${diffPercent}%)`);
            
            if (Math.abs(diff) > 1) {
                console.log(`\n⚠️  PPh21 MISMATCH DETECTED!`);
                console.log(`   Possible causes:`);
                console.log(`   1. Aggregation missing some gangs (e.g., F1BHL)`);
                console.log(`   2. Different calculation methods`);
                console.log(`   3. Employee filtering differences`);
            } else {
                console.log(`\n✅ PPh21 values match (within rounding tolerance)`);
            }
            
            // Find which gangs are in Tax Report but not in Aggregation
            console.log("\n--- Step 4: Find Missing Gangs ---\n");
            const aggGangs = new Set(aggData.map(r => r.gang_code));
            const taxGangs = new Set(Array.from(gangPph21.keys()));
            
            const missingInAgg = Array.from(taxGangs).filter(g => !aggGangs.has(g));
            const missingInTax = Array.from(aggGangs).filter(g => !taxGangs.has(g));
            
            if (missingInAgg.length > 0) {
                console.log(`⚠️  Gangs in Tax Report but NOT in Aggregation (${missingInAgg.length}):`);
                missingInAgg.forEach(gang => {
                    const data = gangPph21.get(gang)!;
                    console.log(`   ${gang}: ${data.count} employees, PPh21: ${data.pph21.toLocaleString('id-ID')}`);
                });
            }
            
            if (missingInTax.length > 0) {
                console.log(`\n⚠️  Gangs in Aggregation but NOT in Tax Report (${missingInTax.length}):`);
                missingInTax.forEach(gang => {
                    const row = aggData.find(r => r.gang_code === gang);
                    console.log(`   ${gang}: ${row?.total_employees} employees, PPh21: ${row?.total_pph21}`);
                });
            }
            
            if (missingInAgg.length === 0 && missingInTax.length === 0) {
                console.log(`✅ All gangs present in both reports`);
            }
        } else {
            console.log("⚠️  No data returned from Tax Report");
        }
    } catch (error: any) {
        console.error(`❌ Failed to get Tax Report: ${error.message}`);
        console.error(error.stack);
    }
    
    console.log("\n=== COMPARISON COMPLETE ===");
}

comparePph21Detailed().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
