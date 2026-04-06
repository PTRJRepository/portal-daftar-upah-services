/**
 * Check what summaryService returns for INF and NRS
 */

import { summaryService } from "./backend/src/services/summaryService.js";

async function checkSummaryData() {
    console.log("=== CHECKING SUMMARY SERVICE INF AND NRS DATA ===\n");
    
    const month = 3;
    const year = 2026;
    
    try {
        const data = await summaryService.getAllDivisionsPremiTotals(month, year, true);
        
        console.log(`Found ${data.length} divisions\n`);
        
        // Find INF and NRS
        const inf = data.find(d => d.division_code === 'INF');
        const nrs = data.find(d => d.division_code === 'NRS');
        
        if (inf) {
            console.log("=== INF DATA ===");
            console.log(`Division Code: ${inf.division_code}`);
            console.log(`Description: ${inf.description}`);
            console.log(`Total Employees: ${inf.total_employees}`);
            console.log(`Total HK: ${inf.total_hk}`);
            console.log(`Total Upah Bersih: ${(inf.total_upah_bersih || 0).toLocaleString('id-ID')}`);
            console.log(`Total Manual: ${(inf.total_manual || 0).toLocaleString('id-ID')}`);
            console.log(`Total Gangs: ${inf.total_gangs}`);
            console.log(`All fields:`, JSON.stringify(inf, null, 2).substring(0, 500));
        } else {
            console.log("❌ INF not found!");
        }
        
        console.log("\n");
        
        if (nrs) {
            console.log("=== NRS DATA ===");
            console.log(`Division Code: ${nrs.division_code}`);
            console.log(`Description: ${nrs.description}`);
            console.log(`Total Employees: ${nrs.total_employees}`);
            console.log(`Total HK: ${nrs.total_hk}`);
            console.log(`Total Upah Bersih: ${(nrs.total_upah_bersih || 0).toLocaleString('id-ID')}`);
            console.log(`Total Manual: ${(nrs.total_manual || 0).toLocaleString('id-ID')}`);
            console.log(`Total Gangs: ${nrs.total_gangs}`);
            console.log(`All fields:`, JSON.stringify(nrs, null, 2).substring(0, 500));
        } else {
            console.log("❌ NRS not found!");
        }
        
        console.log("\n\n=== ALL DIVISIONS OVERVIEW ===");
        console.log("Division".padEnd(12), "Employees".padStart(10), "Gangs".padStart(8), "Upah Bersih".padStart(20));
        console.log("=".repeat(60));
        for (const div of data) {
            if (div.is_grand_total || div.is_subtotal) continue;
            console.log(
                div.division_code.padEnd(12),
                div.total_employees.toString().padStart(10),
                div.total_gangs.toString().padStart(8),
                (div.total_upah_bersih || div.total_manual || 0).toLocaleString('id-ID').padStart(20)
            );
        }
        
    } catch (error: any) {
        console.error("Error:", error.message);
        console.error("Stack:", error.stack);
    }
    
    process.exit(0);
}

checkSummaryData();
