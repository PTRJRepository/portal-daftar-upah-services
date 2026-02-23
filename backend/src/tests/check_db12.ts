import { ptkpTaxService } from '../services/ptkpTaxService';

async function test() {
    try {
        const preview = await ptkpTaxService.previewPtkpUpdate(2025);
        console.log("Distribution of new PTKP targets:");
        console.log(preview.distribution);

        // find which beras_rate matched which new_ptkp by sampling the preview array
        const mapSamples: Record<number, string> = {};
        for (const p of preview.preview) {
            if (!mapSamples[p.beras_rate]) {
                mapSamples[p.beras_rate] = p.new_ptkp;
            }
        }
        console.log("Actual Beras Rates to PTKP mapping found:");
        console.log(mapSamples);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
