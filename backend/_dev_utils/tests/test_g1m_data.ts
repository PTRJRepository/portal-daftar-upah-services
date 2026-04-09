
import { DataExtractorService } from '../../src/services/dataExtractorService';
import { Config } from '../../src/config';

async function testG1M() {
    console.log('Testing G1M Data Extraction...');
    const service = DataExtractorService.getInstance();
    
    const month = 3;
    const year = 2026;
    const gangCode = 'G1M';
    const division = 'ARB1';
    
    try {
        const result = await service.extractPayrollData(
            month, year,
            gangCode,
            division,
            null,
            Config.DB_PROFILE,
            false, // includeVirtualGangs
            false, // useHistoryDb
            '1',   // gangPrefix
            false  // skipHarvest (set to false to match UI)
        );
        
        console.log(`Successfully fetched ${result.data_rows.length} rows.`);
        
        const totalBruto = result.data_rows.reduce((sum: number, r: any) => sum + (Number(r.penghasilan_bruto) || 0), 0);
        const totalPph = result.data_rows.reduce((sum: number, r: any) => sum + (Number(r.pph21_ter) || 0), 0);
        
        console.log(`\n[G1M TEST RESULT]`);
        console.log(`Employees: ${result.data_rows.length}`);
        console.log(`Total Bruto: ${totalBruto.toLocaleString('id-ID')}`);
        console.log(`Total PPh21: ${totalPph.toLocaleString('id-ID')}`);
        
        if (result.data_rows.length > 0) {
            console.log('\nSample Row (First):', {
                emp_code: result.data_rows[0].emp_code,
                nama: result.data_rows[0].nama,
                bruto: result.data_rows[0].penghasilan_bruto,
                pph: result.data_rows[0].pph21_ter
            });
        }
    } catch (err) {
        console.error('Error during extraction:', err);
    }
}

testG1M().then(() => process.exit(0));
