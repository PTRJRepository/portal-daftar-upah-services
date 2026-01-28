import { dataExtractorService } from "./services/dataExtractorService";
import { writeFileSync } from "fs";

async function debug() {
    console.log("Running Extract Payroll Data for Gang A1H - Jan 2025");
    const result = await dataExtractorService.extractPayrollData(1, 2025, "A1H");

    const rahmat = result.data_rows.find(r => r.nama.includes("RAHMAT IQBAL"));

    if (rahmat) {
        console.log("Found RAHMAT IQBAL:");
        console.log({
            nik: rahmat.nik,
            nama: rahmat.nama,
            join_date: rahmat.join_date, // This field might not be in the output interface but logically present in flow
            masa_kerja_lama: rahmat.masa_kerja_lama,
            masa_kerja_jumlah: rahmat.masa_kerja_jumlah,
            masa_kerja_rate: rahmat.masa_kerja_rate
        });
    } else {
        console.log("RAHMAT IQBAL not found in result.");
    }

    writeFileSync("masa_kerja_debug.json", JSON.stringify(result, null, 2));
    process.exit(0);
}

debug().catch(console.error);
