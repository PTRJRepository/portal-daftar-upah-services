import { DataExtractorService } from '../../backend/src/services/dataExtractorService';

async function testMissingFields() {
    try {
        console.log("Starting missing fields test for SAWIN (M1 2026)...");
        const svc = DataExtractorService.getInstance();
        
        // Month 1, 2026
        const result = await svc.extractPayrollData(1, 2026, "ALL", undefined, null, undefined, false, false);
        
        console.log(`Extracted rows: ${result.data_rows.length}`);
        
        // Find SAWIN
        const sawin = result.data_rows.find(r => r.nik === "1906020809770001" || (r.nama && r.nama.includes("SAWIN")));
        
        if (sawin) {
            console.log(`Emp: ${sawin.emp_code} - ${sawin.nama}`);
            console.log(`  jabatan_estate: ${sawin.jabatan_estate}`);
            console.log(`  jabatan_jumlah: ${sawin.jabatan_jumlah}`);
            console.log(`  other_incomes: ${JSON.stringify(sawin.other_incomes)}`);
            console.log(`  pendapatan_thr: ${sawin.pendapatan_thr}`);
            console.log(`  pendapatan_custom: ${sawin.pendapatan_custom}`);
        } else {
            console.log("SAWIN not found in extracted data");
        }

    } catch (error) {
        console.error("Error running test:", error);
    }
}

testMissingFields().then(() => process.exit(0));
