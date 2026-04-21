/**
 * Test Script: Verify brondol data for ARA division harvest gangs
 * Run: cd backend && bun run src/scripts/test_brondol_ara.ts
 */
import { dataExtractorService } from "../services/dataExtractorService";

async function testBrondolARA() {
    const month = 3; // March
    const year = 2026;
    const divisionCode = 'ARA';

    console.log('=== Testing Brondol for ARA Division ===');
    console.log(`Period: ${month}/${year}`);
    console.log(`Division: ${divisionCode}\n`);

    try {
        const result = await dataExtractorService.extractPayrollData(
            month,
            year,
            'ALL',
            divisionCode,
            null,
            undefined,
            false,
            undefined,
            undefined,
            false, // skipHarvest = false (include harvest gangs)
            false  // skipHeavyDetails = false
        );

        console.log(`\n✅ Extracted ${result.data_rows.length} employees\n`);

        // Filter harvest gangs (gang_code ending with H)
        const harvestGangs = result.data_rows.filter(r => r.gang_code?.toUpperCase().endsWith('H'));
        const nonHarvestGangs = result.data_rows.filter(r => !r.gang_code?.toUpperCase().endsWith('H'));

        console.log(`📊 Gang Summary:`);
        console.log(`   Harvest gangs: ${harvestGangs.length} employees`);
        console.log(`   Non-harvest gangs: ${nonHarvestGangs.length} employees\n`);

        // Show brondol data for harvest gangs
        console.log('🍃 Brondol Data for Harvest Gangs:');
        let totalBrondol = 0;
        let countWithBrondol = 0;

        for (const emp of harvestGangs.slice(0, 10)) { // Show first 10
            const brondol = emp.premi_brondol || 0;
            const looseFruit = emp.loose_fruit || 0;
            totalBrondol += brondol;
            if (brondol > 0) countWithBrondol++;

            console.log(`   ${emp.nik} | ${emp.nama} | Gang: ${emp.gang_code} | Brondol: ${brondol.toLocaleString('id-ID')} | Loose Fruit: ${looseFruit}`);
        }

        if (harvestGangs.length > 10) {
            console.log(`   ... and ${harvestGangs.length - 10} more employees`);
        }

        console.log(`\n📈 Summary:`);
        console.log(`   Employees with brondol: ${countWithBrondol}/${harvestGangs.length}`);
        console.log(`   Total brondol: ${totalBrondol.toLocaleString('id-ID')}`);
        console.log(`   Average brondol: ${harvestGangs.length > 0 ? (totalBrondol / harvestGangs.length).toLocaleString('id-ID') : 0}`);

        // Check if there are any non-zero brondol values
        const hasBrondol = harvestGangs.some(emp => (emp.premi_brondol || 0) > 0);
        if (hasBrondol) {
            console.log('\n✅ SUCCESS: Brondol data is now appearing for ARA harvest gangs!');
        } else {
            console.log('\n❌ ISSUE: Brondol is still 0 for all harvest gangs');
            console.log('   Possible causes:');
            console.log('   1. No data in PR_LOOSEFRUIT table for this period');
            console.log('   2. Employee codes mismatch between tables');
            console.log('   3. Date range issue (DocDate not in range)');
        }

    } catch (error) {
        console.error('❌ Error during extraction:', error);
        if (error instanceof Error) {
            console.error('   Message:', error.message);
            console.error('   Stack:', error.stack);
        }
    }
}

testBrondolARA().catch(console.error);
