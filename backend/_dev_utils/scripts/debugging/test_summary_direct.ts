import { summaryService } from "../../../src/services/summaryService";

async function main() {
    console.log("📊 Fetching summary for March 2026 directly...\n");
    
    const result = await summaryService.getAllDivisionsPremiTotals(3, 2026);
    
    if (result && result.length > 0) {
        console.log(`Found ${result.length} divisions\n`);
        
        let totalPph21 = 0;
        for (const div of result) {
            const pph21 = div.total_pph21 || 0;
            totalPph21 += pph21;
            console.log(`${div.division_code}: PPh21 = ${pph21.toLocaleString('id-ID')}`);
        }
        
        console.log(`\n=== TOTAL PPh21: ${totalPph21.toLocaleString('id-ID')} ===`);
    } else {
        console.log("No divisions found!");
    }
}

main().catch(console.error);
