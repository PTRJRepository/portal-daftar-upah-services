import { historyDatabaseService } from "../../src/services/historyDatabaseService";

async function test() {
    console.log("=== Verify seeded data for F0317 ===");
    const data = await historyDatabaseService.getEmployeeHistoricalData("F0317");
    console.log("Career records:", data.career?.length);
    console.log("Payroll records:", data.payroll?.length);
    if (data.payroll?.length > 0) {
        const p = data.payroll[0];
        console.log("Sample payroll keys:", Object.keys(p).join(', '));
        console.log("Sample:", {
            period: `${p.period_month}/${p.period_year}`,
            upah_dasar: p.upah_dasar, gaji_pokok: p.gaji_pokok_aktual,
            beras_rate: p.beras_rate, beras_jumlah: p.beras_jumlah,
            upah_kotor: p.jumlah_upah_kotor, upah_bersih: p.upah_bersih,
            pot_spsi: p.pot_spsi, pot_pph21: p.pot_pph21,
            bpjs_kes_p: p.pot_bpjs_kesehatan_pekerja, astek_p: p.pot_astek_pekerja
        });
    }
    process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
