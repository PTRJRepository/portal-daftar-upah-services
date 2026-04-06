import { taxReportService } from '../../backend/src/services/taxReportService';
import { generateMonthlyTaxExcel } from '../../backend/src/services/taxReportExcelService';

async function testExport() {
    console.log('Starting Tax Export Test...');
    const year = 2026;
    const month = 3;
    const division = 'REBINMAS'; // Adjust to existing division
    const gang = 'ALL';
    
    try {
        console.log(`Fetching data for ${month}/${year}...`);
        const data = await taxReportService.getMonthlyTaxReport(year, month, division, gang, undefined, true);
        
        console.log(`Data fetched: ${data.employees.length} employees`);
        if (data.employees.length === 0) {
            console.log('No data found, cannot test Excel generation.');
            return;
        }

        console.log('Generating Excel Buffer...');
        const excelBuffer = await generateMonthlyTaxExcel(data, year, month, division, gang, data.premiKeys);
        
        console.log(`Excel Buffer generated. Size: ${excelBuffer.length} bytes`);
        if (excelBuffer.length === 0) {
            console.error('FAILED: Excel Buffer is 0 bytes!');
        } else {
            console.log('SUCCESS: Excel Buffer is valid.');
        }
    } catch (error) {
        console.error('Error during test:', error);
    }
}

testExport();
