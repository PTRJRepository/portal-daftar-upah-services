import { OtherIncomesService } from "../src/services/otherIncomesService";

async function testInfraTHR() {
    const year = 2025;
    const month = 3;
    const division = "INF";
    
    console.log(`Calculating THR for ${division} ${month}/${year}...`);
    const results = await OtherIncomesService.calculateTHRData(year, month, division, "ALL");
    console.log(`Results: ${results.length} rows found.`);
    
    if (results.length > 0) {
        console.log("Sample row:", JSON.stringify(results[0], null, 2));
    } else {
        console.log("No data found for Infra calculation.");
    }
}

testInfraTHR().catch(console.error);
