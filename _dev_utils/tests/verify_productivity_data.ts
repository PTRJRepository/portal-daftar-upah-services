import { summaryService } from '../../backend/src/services/summaryService';

async function verifyProductivityData() {
    console.log("Fetching Productivity Data for Month 2, Year 2026...");
    try {
        const data = await summaryService.getAllDivisionsPremiTotals(2, 2026);
        console.log(`Successfully fetched data for ${data.length} divisions.`);

        console.log("\n--- Sample Division Data ---");
        // Print out 3 samples
        for (let i = 0; i < Math.min(3, data.length); i++) {
            const row = data[i];
            console.log(`Divisi: ${row.division_code}`);
            console.log(`  Tonase (FFB Weight): ${row.total_ffb_weight}`);
            console.log(`  Upah Bersih: ${row.total_upah_bersih}`);
            console.log(`  Total HK: ${row.total_hk}`);
        }

        console.log("\n✅ Verification script completed successfully.");
    } catch (e) {
        console.error("❌ Error fetching productivity data:", e);
    }
}

verifyProductivityData();
