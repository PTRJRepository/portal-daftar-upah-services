/**
 * Debug: Call extractPayrollData directly to see what it returns
 */
import { dataExtractorService } from "../../../backend/src/services/dataExtractorService";

async function main() {
    console.log('Calling extractPayrollData for gang L1H, month=3, year=2026...');
    try {
        const result = await dataExtractorService.extractPayrollData(
            3,      // month
            2026,   // year
            'L1H',  // gangCode
            undefined, // divisionCode
            null,   // specificEmpCode
            'SERVER_PROFILE_2', // serverProfile
            false,  // includeVirtualGangs
            false,  // useHistoryDb (set to false to force live path)
            undefined // gangPrefix
        );
        console.log(`Result: ${result.data_rows.length} rows`);
        console.log('Meta:', JSON.stringify(result.meta));
        if (result.data_rows.length > 0) {
            result.data_rows.slice(0, 5).forEach(r => {
                console.log(`  ${r.emp_code} | ${r.nama} | gang=${r.gang_code}`);
            });
        }
    } catch (e: any) {
        console.error('Error:', e.message);
        console.error(e.stack);
    }
}
main().catch(console.error);
