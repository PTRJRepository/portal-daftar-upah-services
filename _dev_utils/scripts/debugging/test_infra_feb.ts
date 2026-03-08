import { dataExtractorService } from '../src/services/dataExtractorService';

async function testInfraFeb() {
    console.log("Fetching INFRASTUKTUR gang for February 2025...");
    try {
        const resultFeb = await dataExtractorService.extractPayrollData(2, 2025, "INFRASTUKTUR", undefined, undefined, "SERVER_PROFILE_2");
        console.log(`February: Found ${resultFeb.data_rows.length} employees`);

        if (resultFeb.data_rows.length > 0) {
            for (const row of resultFeb.data_rows) {
                if (row.nama.includes("YOYO") || row.nama.includes("JAMILA") || row.nama.includes("SUHANDI") || row.nama.includes("HARIAH") || row.nama.includes("JUNI")) {
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

testInfraFeb();
