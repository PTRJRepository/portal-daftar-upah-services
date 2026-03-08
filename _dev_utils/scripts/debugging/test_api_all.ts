import { OtherIncomesService } from "../src/services/otherIncomesService";

async function testApiAll() {
    const year = 2026;
    const month = 2;
    const division = 'ALL';
    const gang = 'ALL';

    console.log("Calling OtherIncomesService.getIncomesWithDetails for ALL...");
    const incomes = await OtherIncomesService.getIncomesWithDetails(year, month, division, gang);
    
    console.log(`Returned ${incomes.length} incomes.`);
}

testApiAll();
