import { dataExtractorService } from '../src/services/dataExtractorService';

async function testInfraNov() {
    console.log("Fetching INFRASTUKTUR gang for November 2025...");
    try {
        const resultNov = await dataExtractorService.extractPayrollData(11, 2025, "INFRASTUKTUR", undefined, undefined, "SERVER_PROFILE_2");
        console.log(`November: Found ${resultNov.data_rows.length} employees`);

        if (resultNov.data_rows.length > 0) {
            for (const row of resultNov.data_rows) {
                if (row.nama.includes("YOYO") || row.nama.includes("JAMILA") || row.nama.includes("SUHANDI") || row.nama.includes("HARIAH")) {
                    console.log(`\n--- ${row.nama} (${row.nik}) ---`);
                    console.log(`Upah Kotor (API):       ${row.jumlah_upah_kotor}`);
                    console.log(`  Gaji Pokok (Hitam):   ${row.gaji_pokok_aktual}`);
                    console.log(`  Total Tunjangan:      ${row.total_tunjangan}`);
                    console.log(`  Total Premi:          ${row.total_premi}`);
                    console.log(`  Pot. Koreksi:         ${row.pot_koreksi}`);
                    console.log(`  Lembur:               ${row.lembur_jumlah}`);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}

testInfraNov();
