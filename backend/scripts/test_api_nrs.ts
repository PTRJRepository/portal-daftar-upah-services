import { OtherIncomesService } from "../src/services/otherIncomesService";

async function testApi() {
    const year = 2026;
    const month = 2;
    const division = 'NRS';
    const gang = 'B2N';

    console.log("Calling OtherIncomesService.getIncomesWithDetails...");
    const incomes = await OtherIncomesService.getIncomesWithDetails(year, month, division, gang);
    
    console.log(`Returned ${incomes.length} incomes.`);
    if (incomes.length > 0) {
        console.log("First record sample:");
        console.log(JSON.stringify(incomes[0], null, 2));
    } else {
        // If empty, check why by calling getIncomes directly
        const rawIncomes = await OtherIncomesService.getIncomes(year, month, division, gang);
        console.log(`Raw getIncomes returned ${rawIncomes.length} records.`);
    }
}

testApi();
