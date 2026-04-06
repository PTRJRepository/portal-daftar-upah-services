import { SummaryService } from "../../src/services/summaryService";
import { Database } from "../../src/db/client";

async function testWorkshop() {
    console.log("Starting workshop aggregation test...");
    const summaryService = SummaryService.getInstance();
    const month = 3;
    const year = 2026;

    try {
        const results = await summaryService.getAllDivisionsPremiTotals(month, year, true);
        
        console.log("\n--- Aggregation Results ---");
        const workshops = results.filter(r => 
            r.division_code === 'WKS_PG' || 
            r.division_code === 'WKS_AR' || 
            r.division_code === 'WORKSHOP'
        );

        if (workshops.length === 0) {
            console.log("No workshop data found for March 2026.");
        } else {
            for (const w of workshops) {
                console.log(`Division: ${w.division_code} (${w.description})`);
                console.log(`  Employees: ${w.total_employees}`);
                console.log(`  Upah Bersih: ${w.total_upah_bersih}`);
                console.log(`  Gangs: ${w.total_gangs}`);
            }
        }

        // Check for common real divisions that might have INF/NRS
        const p1a = results.find(r => r.division_code === 'PG1A');
        const inf = results.find(r => r.division_code === 'INF');
        if (p1a && inf) {
            console.log(`\nDivision: PG1A (Plasma 1A) - Employees: ${p1a.total_employees}`);
            console.log(`Division: INF (Infrastructure) - Employees: ${inf.total_employees}`);
        }

    } catch (e) {
        console.error("Test failed:", e);
    } finally {
        process.exit(0);
    }
}

testWorkshop();
