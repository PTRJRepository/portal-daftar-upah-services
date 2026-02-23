/**
 * test_comparison_jan.ts
 * 
 * Uji Komparasi: Database Original (db_ptrj) vs History (extend_db_ptrj)
 * Periode: Januari 2026
 * 
 * Menarik data dari kedua sumber dan membandingkan field-by-field
 * untuk membuktikan bahwa data history identik dengan data original.
 */

import { dataExtractorService } from "../../backend/src/services/dataExtractorService";
import { historyDatabaseService } from "../../backend/src/services/historyDatabaseService";
import { Config } from "../../backend/src/config";

Config.RUN_MODE = "prod";

const TEST_MONTH = 1;
const TEST_YEAR = 2026;

// Fields to compare (core financial fields)
const COMPARE_FIELDS = [
    'gaji_pokok', 'upah_dasar', 'jumlah_hk', 'hari_kerja',
    'beras_jumlah', 'jabatan_jumlah', 'masa_kerja_jumlah',
    'lembur_jam', 'lembur_jumlah',
    'total_tunjangan', 'total_premi', 'premi_brondol',
    'pot_koreksi', 'pot_spsi', 'pot_pph21',
    'pot_bpjs_kesehatan_pekerja', 'pot_bpjs_pensiun_pekerja',
    'pot_astek', 'total_potongan',
    'jumlah_upah_kotor', 'upah_bersih',
    'penghasilan_bruto', 'tarif_pajak_ter', 'pph21_ter'
];

async function main() {
    console.log("╔══════════════════════════════════════════════════════╗");
    console.log("║  KOMPARASI: db_ptrj (Original) vs extend_db_ptrj   ║");
    console.log(`║  Periode: ${TEST_MONTH}/${TEST_YEAR}                                      ║`);
    console.log("╚══════════════════════════════════════════════════════╝\n");

    // ========== STEP 1: Fetch from ORIGINAL (db_ptrj) ==========
    console.log("━━━ [1/3] Mengambil data dari db_ptrj (DataExtractorService) ━━━");

    // Temporarily disable history interceptor by checking directly
    const originalData = await dataExtractorService.extractPayrollData(
        TEST_MONTH, TEST_YEAR, "ALL", undefined, null, Config.DB_PROFILE
    );

    if (!originalData || originalData.data_rows.length === 0) {
        console.log("❌ Tidak ada data original untuk periode ini. Proses dihentikan.");
        process.exit(1);
    }
    console.log(`✅ Data original: ${originalData.data_rows.length} karyawan\n`);

    // ========== STEP 2: Fetch from HISTORY (extend_db_ptrj) ==========
    console.log("━━━ [2/3] Mengambil data dari extend_db_ptrj (History Snapshot) ━━━");

    const historyData = await historyDatabaseService.getHistoricalPayrollDataAsExtractorFormat(
        TEST_MONTH, TEST_YEAR
    );

    if (!historyData || historyData.data_rows.length === 0) {
        console.log("❌ Tidak ada data history yang sudah di-seed untuk periode ini.");
        console.log("   Jalankan 'Aggregation Seeder' terlebih dahulu untuk periode ini.");
        process.exit(1);
    }
    console.log(`✅ Data history:  ${historyData.data_rows.length} karyawan\n`);

    // ========== STEP 3: Compare Field-by-Field ==========
    console.log("━━━ [3/3] Membandingkan Field-by-Field ━━━\n");

    // Build lookup maps by emp_code
    const originalMap = new Map<string, any>();
    for (const row of originalData.data_rows) {
        const key = (row.emp_code || row.nik || '').toString().trim().toUpperCase();
        if (key) originalMap.set(key, row);
    }

    const historyMap = new Map<string, any>();
    for (const row of historyData.data_rows) {
        const key = (row.emp_code || row.nik || '').toString().trim().toUpperCase();
        if (key) historyMap.set(key, row);
    }

    let totalCompared = 0;
    let totalMatched = 0;
    let totalMismatched = 0;
    let missingInHistory = 0;
    let missingInOriginal = 0;
    const mismatchDetails: Array<{ emp: string, field: string, original: number, history: number, diff: number }> = [];

    // Compare each original employee against history
    for (const [empCode, origRow] of originalMap) {
        const histRow = historyMap.get(empCode);

        if (!histRow) {
            missingInHistory++;
            continue;
        }

        totalCompared++;
        let rowMatch = true;

        for (const field of COMPARE_FIELDS) {
            const origVal = parseFloat(origRow[field]) || 0;
            const histVal = parseFloat(histRow[field]) || 0;
            const diff = Math.abs(origVal - histVal);

            // Allow tiny floating point tolerance (< 1 Rupiah)
            if (diff > 1) {
                rowMatch = false;
                mismatchDetails.push({
                    emp: `${empCode} (${origRow.nama || histRow.emp_name || '?'})`,
                    field,
                    original: origVal,
                    history: histVal,
                    diff
                });
            }
        }

        if (rowMatch) totalMatched++;
        else totalMismatched++;
    }

    // Check for employees in history but not in original
    for (const [empCode] of historyMap) {
        if (!originalMap.has(empCode)) {
            missingInOriginal++;
        }
    }

    // ========== RESULTS ==========
    console.log("┌────────────────────────────────────────────┐");
    console.log("│           HASIL UJI KOMPARASI              │");
    console.log("├────────────────────────────────────────────┤");
    console.log(`│  Periode           : ${TEST_MONTH}/${TEST_YEAR}                  │`);
    console.log(`│  Karyawan Original : ${originalData.data_rows.length.toString().padStart(4)}                    │`);
    console.log(`│  Karyawan History  : ${historyData.data_rows.length.toString().padStart(4)}                    │`);
    console.log(`│  Dibandingkan      : ${totalCompared.toString().padStart(4)}                    │`);
    console.log(`│  ✅ Identik        : ${totalMatched.toString().padStart(4)}                    │`);
    console.log(`│  ❌ Berbeda        : ${totalMismatched.toString().padStart(4)}                    │`);
    console.log(`│  ⚠️  Missing (Hist) : ${missingInHistory.toString().padStart(4)}                    │`);
    console.log(`│  ⚠️  Missing (Orig) : ${missingInOriginal.toString().padStart(4)}                    │`);
    console.log("└────────────────────────────────────────────┘");

    if (mismatchDetails.length > 0) {
        console.log("\n❌ DETAIL PERBEDAAN (max 20 ditampilkan):");
        console.log("─".repeat(90));
        console.log("Karyawan".padEnd(30) + "Field".padEnd(25) + "Original".padStart(12) + "History".padStart(12) + "Diff".padStart(12));
        console.log("─".repeat(90));

        for (const m of mismatchDetails.slice(0, 20)) {
            console.log(
                m.emp.substring(0, 28).padEnd(30) +
                m.field.padEnd(25) +
                m.original.toFixed(0).padStart(12) +
                m.history.toFixed(0).padStart(12) +
                m.diff.toFixed(0).padStart(12)
            );
        }

        if (mismatchDetails.length > 20) {
            console.log(`\n   ... dan ${mismatchDetails.length - 20} perbedaan lainnya.`);
        }
    } else if (totalCompared > 0) {
        console.log("\n🎉 SEMPURNA! Semua data identik antara db_ptrj dan extend_db_ptrj.");
        console.log("   Transisi Switch Mode dapat dilakukan dengan aman.");
    }

    // Check structural compatibility
    console.log("\n━━━ Kompatibilitas Struktur Response ━━━");
    console.log(`  Original keys : ${Object.keys(originalData).join(', ')}`);
    console.log(`  History keys  : ${Object.keys(historyData).join(', ')}`);

    const origKeys = new Set(Object.keys(originalData));
    const histKeys = new Set(Object.keys(historyData));
    const extraInHistory = [...histKeys].filter(k => !origKeys.has(k));
    const missingFromHistory = [...origKeys].filter(k => !histKeys.has(k));

    if (extraInHistory.length > 0) console.log(`  Extra di history: ${extraInHistory.join(', ')}`);
    if (missingFromHistory.length > 0) console.log(`  Missing di history: ${missingFromHistory.join(', ')}`);
    if (extraInHistory.length === 0 && missingFromHistory.length === 0) {
        console.log("  ✅ Struktur response identik!");
    }

    console.log("\n===== SELESAI =====");
    process.exit(0);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
