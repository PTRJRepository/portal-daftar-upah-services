import { ptkpTaxService } from './src/services/ptkpTaxService';

async function testPreview() {
    try {
        console.log("Running PTKP preview for 2026...");
        const preview = await ptkpTaxService.previewPtkpUpdate(2026);
        console.log(`Preview found ${preview.total_employees} active employees.`);
        console.log("Distribution:", preview.distribution);

        const changing = preview.preview.filter(p => p.will_change);
        console.log(`\nFound ${changing.length} employees whose PTKP will change if updated.`);
        console.log("Sample changes:", changing.slice(0, 5));

    } catch (e) {
        console.error("Test failed:", e);
    }
}

testPreview().then(() => process.exit(0));
