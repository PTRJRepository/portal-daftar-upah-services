
import { taxReportService } from "../../src/services/taxReportService";

async function verifyFix() {
    const service = taxReportService;
    
    const year = 2026;
    const month = 3;
    const divisionCode = 'PG1A'; // Example division

    console.log(`Verifying Tax Report fix for ${month}/${year}, Division: ${divisionCode}...`);

    try {
        const result = await service.getMonthlyTaxReport(year, month, divisionCode);
        
        console.log(`Report generated with ${result.employees.length} employees.`);
        
        const withPph = result.employees.filter(e => e.pph21_ter > 0);
        console.log(`Employees with PPH21 > 0: ${withPph.length}`);
        
        if (withPph.length > 0) {
            console.log('Sample employees with PPH21:');
            console.table(withPph.slice(0, 5).map(e => ({
                emp_code: e.emp_code,
                emp_name: e.emp_name,
                pph21_ter: e.pph21_ter,
                bruto: e.penghasilan_bruto
            })));
            
            console.log('\n✅ SUCCESS: PPH21 data is now appearing in the report!');
        } else {
            console.log('\n❌ FAILED: Still no PPH21 data in the report.');
        }

    } catch (error) {
        console.error('Error during verification:', error);
    }

    process.exit(0);
}

verifyFix().catch(console.error);
