// Verify that other incomes are properly included in payroll calculations
import { dataExtractorService } from '../../backend/src/services/dataExtractorService';

async function main() {
    console.log('=== Verifying Other Incomes in Payroll Report ===\n');

    // Check for March 2026 with a sample gang
    console.log('Fetching payroll data for March 2026...');
    console.log('(Checking if THR data from month 3 is included)\n');

    try {
        const result = await dataExtractorService.extractPayrollData({
            month: 3,
            year: 2026,
            gangCode: 'AMC',  // Workshop gang
            divisionCode: 'WKS_PG'
        });

        const rows = result.data_rows || [];
        console.log(`Found ${rows.length} employees\n`);

        // Check first few rows for other_incomes
        let rowsWithOtherIncomes = 0;
        let totalOtherIncomes = 0;

        for (const row of rows.slice(0, 20)) {
            if (row.other_incomes && row.other_incomes.length > 0) {
                rowsWithOtherIncomes++;
                const thrAmount = row.other_incomes
                    .filter(oi => oi.type === 'THR')
                    .reduce((sum, oi) => sum + Number(oi.amount), 0);
                totalOtherIncomes += thrAmount;

                console.log(`${row.nama}: THR = Rp ${thrAmount.toLocaleString()}`);
            }
        }

        console.log(`\n--- Summary ---`);
        console.log(`Employees with other incomes (first 20): ${rowsWithOtherIncomes}`);
        console.log(`Total THR amount (first 20): Rp ${totalOtherIncomes.toLocaleString()}`);

        // Check aggregation fields
        if (rows[0]) {
            console.log(`\n--- Available Fields ---`);
            console.log(`pendapatan_tidak_tetap_thp: ${rows[0].pendapatan_tidak_tetap_thp}`);
            console.log(`pendapatan_tidak_tetap_taxable: ${rows[0].pendapatan_tidak_tetap_taxable}`);
            console.log(`jumlah_upah_kotor: ${rows[0].jumlah_upah_kotor}`);
            console.log(`upah_bersih: ${rows[0].upah_bersih}`);
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

main().catch(console.error);
