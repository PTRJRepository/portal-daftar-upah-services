/**
 * Debug script to check PPh21 TER values in history database for gang A1H, division P1A
 * Run: bun run backend/src/scripts/debug_pph21_history.ts
 */
import { historyDatabaseService } from '../services/historyDatabaseService';

async function main() {
    const month = 1; // January 2025 (adjust as needed)
    const year = 2025;
    const gangCode = 'A1H';
    const divisionCode = 'P1A';

    console.log(`\n=== Checking PPh21 TER in History Database ===`);
    console.log(`Period: ${month}/${year}`);
    console.log(`Gang: ${gangCode}`);
    console.log(`Division: ${divisionCode}\n`);

    const historyData = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(
        month, year, gangCode, divisionCode
    );

    if (!historyData || historyData.data_rows.length === 0) {
        console.log('❌ No history data found for this period/gang/division');
        console.log('This might mean the data has not been seeded yet.');
        process.exit(0);
    }

    console.log(`✅ Found ${historyData.data_rows.length} employees in history\n`);

    let totalPph21Ter = 0;
    let totalPotPph21 = 0;
    let employeesWithPph21Ter = 0;
    let employeesWithPotPph21 = 0;

    // Show first 5 employees as sample
    console.log('=== Sample Data (First 5 employees) ===\n');
    for (let i = 0; i < Math.min(5, historyData.data_rows.length); i++) {
        const row = historyData.data_rows[i];
        const pph21Ter = row.pph21_ter || 0;
        const potPph21 = row.pot_pph21 || 0;
        
        console.log(`Employee #${i + 1}:`);
        console.log(`  emp_code: ${row.emp_code}`);
        console.log(`  emp_name: ${row.nama || row.emp_name}`);
        console.log(`  gang_code: ${row.gang_code}`);
        console.log(`  pph21_ter: ${pph21Ter.toLocaleString('id-ID')}`);
        console.log(`  pot_pph21: ${potPph21.toLocaleString('id-ID')}`);
        console.log(`  jumlah_upah_kotor: ${(row.jumlah_upah_kotor || 0).toLocaleString('id-ID')}`);
        console.log(`  penghasilan_bruto: ${(row.penghasilan_bruto || 0).toLocaleString('id-ID')}`);
        console.log(`  tarif_pajak_ter: ${row.tarif_pajak_ter || 0}%`);
        console.log('');

        if (pph21Ter > 0) employeesWithPph21Ter++;
        if (potPph21 > 0) employeesWithPotPph21++;
        totalPph21Ter += pph21Ter;
        totalPotPph21 += potPph21;
    }

    // Calculate totals for all employees
    for (const row of historyData.data_rows) {
        const pph21Ter = row.pph21_ter || 0;
        const potPph21 = row.pot_pph21 || 0;
        
        if (pph21Ter > 0 && !historyData.data_rows.slice(0, 5).includes(row)) employeesWithPph21Ter++;
        if (potPph21 > 0 && !historyData.data_rows.slice(0, 5).includes(row)) employeesWithPotPph21++;
        totalPph21Ter += pph21Ter;
        totalPotPph21 += potPph21;
    }

    console.log('=== Summary for ALL employees ===');
    console.log(`Total employees: ${historyData.data_rows.length}`);
    console.log(`Employees with pph21_ter > 0: ${employeesWithPph21Ter}`);
    console.log(`Employees with pot_pph21 > 0: ${employeesWithPotPph21}`);
    console.log(`\nTotal pph21_ter: ${totalPph21Ter.toLocaleString('id-ID')}`);
    console.log(`Total pot_pph21: ${totalPotPph21.toLocaleString('id-ID')}`);

    // Check available fields in first row
    console.log('\n=== Available Fields in First Row ===');
    if (historyData.data_rows.length > 0) {
        const firstRow = historyData.data_rows[0];
        const taxRelatedFields = Object.keys(firstRow).filter(k => 
            k.includes('pph') || k.includes('pajak') || k.includes('tax') || k.includes('ptkp') || k.includes('ter')
        );
        console.log('Tax-related fields:', taxRelatedFields);
    }

    process.exit(0);
}

main().catch(e => { 
    console.error('❌ Error:', e.message); 
    console.error(e);
    process.exit(1); 
});
