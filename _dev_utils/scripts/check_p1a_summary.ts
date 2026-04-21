/**
 * Check what summaryService.getAllDivisionsPremiTotals returns for P1A
 */

import { summaryService } from "./backend/src/services/summaryService.js";

async function checkP1ASummary() {
    console.log("=== CHECKING P1A SUMMARY DATA ===\n");
    
    try {
        const month = 3;
        const year = 2026;
        
        console.log("Calling summaryService.getAllDivisionsPremiTotals...");
        const data = await summaryService.getAllDivisionsPremiTotals(month, year, true); // includeVirtual=true
        
        console.log(`\nFound ${data.length} divisions\n`);
        
        // Find P1A
        const p1a = data.find(d => d.division_code === 'P1A');
        
        if (p1a) {
            console.log("=== P1A DATA ===");
            console.log(`Division Code: ${p1a.division_code}`);
            console.log(`Description: ${p1a.description}`);
            console.log(`Total Employees: ${p1a.total_employees}`);
            console.log(`Total HK: ${p1a.total_hk}`);
            console.log(`Total PPH21: ${(p1a.total_pph21 || 0).toLocaleString('id-ID')}`);
            console.log(`Total SPSI: ${(p1a.total_spsi || 0).toLocaleString('id-ID')}`);
            console.log(`Total Premi: ${(p1a.total_premi || 0).toLocaleString('id-ID')}`);
            console.log(`Total Lembur: ${(p1a.total_lembur || 0).toLocaleString('id-ID')}`);
            console.log(`Total Upah Bersih: ${(p1a.total_upah_bersih || 0).toLocaleString('id-ID')}`);
            console.log(`Total Manual: ${(p1a.total_manual || 0).toLocaleString('id-ID')}`);
            console.log(`Thumb Print: ${(p1a.thumb_print || 0).toLocaleString('id-ID')}`);
            console.log(`Selisih: ${(p1a.selisih || 0).toLocaleString('id-ID')}`);
            console.log(`Total Gangs: ${p1a.total_gangs}`);
            
            console.log("\nExpected: 893.458.119 (for Upah Bersih/Manual)");
        } else {
            console.error("P1A not found in summary data!");
        }
        
        // Show all divisions briefly
        console.log("\n\n=== ALL DIVISIONS SUMMARY ===");
        console.log("Division".padEnd(12), "Employees".padStart(10), "Manual/Upah Bersih".padStart(25));
        console.log("=".repeat(60));
        for (const div of data) {
            if (div.is_grand_total || div.is_subtotal) continue;
            console.log(
                div.division_code.padEnd(12),
                div.total_employees.toString().padStart(10),
                (div.total_manual || div.total_upah_bersih || 0).toLocaleString('id-ID').padStart(25)
            );
        }
        
    } catch (error: any) {
        console.error("Error:", error.message);
        console.error("Stack:", error.stack);
    }
    
    process.exit(0);
}

checkP1ASummary();
