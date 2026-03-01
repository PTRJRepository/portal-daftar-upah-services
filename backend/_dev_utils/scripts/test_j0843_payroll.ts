import { DataExtractorService } from "../../src/services/dataExtractorService";
import { Config } from "../../src/config";

async function main() {
    const extractor = DataExtractorService.getInstance();

    console.log("Testing full extractPayrollData for J0843...");
    const result = await extractor.extractPayrollData(2, 2026, "J1P", "ARC", null, Config.DB_PROFILE, false);

    console.log(`Total rows for J1P: ${result.data_rows.length}`);

    const j0843 = result.data_rows.find(r => r.emp_code === "J0843");
    if (j0843) {
        console.log("✅ J0843 FOUND in J1P!");
        console.log(`  Name: ${j0843.nama}`);
        console.log(`  Gang: ${j0843.gang_code}`);
        console.log(`  HK: ${j0843.jumlah_hk}`);
        console.log(`  Gaji Pokok: ${j0843.gaji_pokok}`);
        console.log(`  Upah Bersih: ${j0843.upah_bersih}`);
    } else {
        console.log("❌ J0843 NOT FOUND in J1P payroll data!");
        console.log("All emp_codes:", result.data_rows.map(r => r.emp_code));
    }
}

main().catch(console.error).finally(() => process.exit(0));
