import { DataExtractorService } from "./src/services/dataExtractorService";

async function run() {
    const service = DataExtractorService.getInstance();
    
    // Test for a known division/gang
    // From my check script: AB2 has H1H, H1M, etc.
    const month = 3;
    const year = 2026;
    const division = "AB2";
    const gang = "ALL";

    console.log(`Simulating extractPayrollData for ${month}/${year}, Div: ${division}, Gang: ${gang}...`);

    try {
        const result = await service.extractPayrollData(month, year, gang, division);
        console.log(`Success! Rows returned: ${result.data_rows.length}`);
        if (result.data_rows.length > 0) {
            console.log("First row summary:");
            const first = result.data_rows[0];
            console.log(`NIK: ${first.nik}, Name: ${first.nama}, Gang: ${first.gang_code}, HK: ${first.jumlah_hk}`);
        } else {
            console.log("No rows returned.");
        }
    } catch (err) {
        console.error("Error during extraction:", err);
    }

    process.exit(0);
}

run();
