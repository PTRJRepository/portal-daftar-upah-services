import { DataExtractorService } from '../../backend/src/services/dataExtractorService';

async function testThrMerge() {
    try {
        console.log("Starting THR merge test A0778 (M3 2024?)...");
        const svc = DataExtractorService.getInstance();
        
        // Month 3, 2024
        const result = await svc.extractPayrollData(3, 2024, "ALL", undefined, "A0778", undefined, false, false);
        
        console.log(`Extracted rows: ${result.data_rows.length}`);
        
        const sawin = result.data_rows[0];
        
        if (sawin) {
            console.log(`Emp: ${sawin.emp_code} - ${sawin.nama}`);
            console.log(`  other_incomes: ${JSON.stringify(sawin.other_incomes, null, 2)}`);
            console.log(`  pendapatan_thr: ${sawin.pendapatan_thr}`);
            console.log(`  pendapatan_custom: ${sawin.pendapatan_custom}`);
        } else {
            console.log("A0778 not found in extracted data");
        }

    } catch (error) {
        console.error("Error running test:", error);
    }
}

testThrMerge().then(() => process.exit(0));
