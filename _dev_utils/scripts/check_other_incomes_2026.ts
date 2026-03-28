// Script to check other incomes for 2026
import { OtherIncomesService } from '../../backend/src/services/otherIncomesService';

async function main() {
    console.log('=== Checking Other Incomes for 2026 ===\n');

    // Check month 2
    console.log('--- Month 2, 2026 ---');
    const incomesFeb = await OtherIncomesService.getRawIncomes(2026, 2);
    console.log(`Found ${incomesFeb.length} records for Feb 2026`);
    if (incomesFeb.length > 0) {
        console.log('Sample:', JSON.stringify(incomesFeb[0], null, 2));
        console.log('Total amount:', incomesFeb.reduce((sum, i) => sum + Number(i.amount), 0));
    }

    // Check month 3
    console.log('\n--- Month 3, 2026 ---');
    const incomesMar = await OtherIncomesService.getRawIncomes(2026, 3);
    console.log(`Found ${incomesMar.length} records for Mar 2026`);
    if (incomesMar.length > 0) {
        console.log('Sample:', JSON.stringify(incomesMar[0], null, 2));
        console.log('Total amount:', incomesMar.reduce((sum, i) => sum + Number(i.amount), 0));
    }

    console.log('\n--- Checking what month should be used ---');
    console.log('User wants: Month 3 for year 2026');
    console.log('Current data is in: Month 2 for year 2026');
}

main().catch(console.error);
