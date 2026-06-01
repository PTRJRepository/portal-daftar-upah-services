import { ptkpTaxService } from '../services/ptkpTaxService';

async function test() {
    try {
        console.log("Triggering PTKP Update for 2025 with the newly fixed logic...");
        const res = await ptkpTaxService.updatePtkpForYear(2025, 'system_fix');
        console.log("Update result:", JSON.stringify(res, null, 2));

        const previewAfter = await ptkpTaxService.previewPtkpUpdate(2025);
        console.log("\nNew Distribution of PTKP targets in DB:");
        console.log(previewAfter.distribution);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
