import { dataExtractorService } from "../../../src/services/dataExtractorService";
import { Database } from "../../../src/db/client";

async function main() {
    const month = 3;
    const year = 2026;
    const testGang = "A1H"; // Test gang from P1A
    const testDiv = "P1A";

    console.log(`=== COMPARISON: Daftar Upah vs Aggregation History ===`);
    console.log(`Gang: ${testGang}, Division: ${testDiv}, Period: ${month}/${year}\n`);

    // ===== 1. Get live data from dataExtractor (same as Daftar Upah) =====
    console.log("📊 Fetching LIVE data (Daftar Upah source)...");
    const liveData = await dataExtractorService.extractPayrollData(
        month, year, testGang, testDiv, null, "SERVER_PROFILE_2", false, false
    );

    const liveRows = liveData.data_rows || [];
    console.log(`Live employees: ${liveRows.length}\n`);

    // Calculate totals from live data
    let liveTotal = {
        employees: liveRows.length,
        total_hk: 0,
        gaji_pokok: 0,
        beras_jumlah: 0,
        jabatan_jumlah: 0,
        masa_kerja_jumlah: 0,
        lembur_jumlah: 0,
        total_tunjangan: 0,
        premi_brondol: 0,
        premi_pruning: 0,
        total_premi: 0,
        pot_pph21: 0,
        pot_spsi: 0,
        pot_bpjs_pekerja_total: 0,
        pot_koreksi: 0,
        total_potongan: 0,
        jumlah_upah_kotor: 0,
        upah_bersih: 0,
        pendapatan_lainnya: 0,
    };

    for (const emp of liveRows) {
        liveTotal.total_hk += emp.jumlah_hk || 0;
        liveTotal.gaji_pokok += emp.gaji_pokok || 0;
        liveTotal.beras_jumlah += emp.beras_jumlah || 0;
        liveTotal.jabatan_jumlah += emp.jabatan_jumlah || 0;
        liveTotal.masa_kerja_jumlah += emp.masa_kerja_jumlah || 0;
        liveTotal.lembur_jumlah += emp.lembur_jumlah || 0;
        liveTotal.total_tunjangan += emp.total_tunjangan || 0;
        liveTotal.premi_brondol += emp.premi_brondol || 0;
        liveTotal.premi_pruning += emp.premi_pruning || 0;
        liveTotal.total_premi += emp.total_premi || 0;
        liveTotal.pot_pph21 += emp.pot_pph21 || 0;
        liveTotal.pot_spsi += emp.pot_spsi || 0;
        liveTotal.pot_bpjs_pekerja_total += emp.pot_bpjs_pekerja_total || 0;
        liveTotal.pot_koreksi += emp.pot_koreksi || 0;
        liveTotal.total_potongan += emp.total_potongan || 0;
        liveTotal.jumlah_upah_kotor += emp.jumlah_upah_kotor || 0;
        liveTotal.upah_bersih += emp.upah_bersih || 0;
        liveTotal.pendapatan_lainnya += emp.pendapatan_lainnya || 0;
    }

    // ===== 2. Get aggregation history data =====
    console.log("📊 Fetching AGGREGATION HISTORY data...");
    const extDb = Database.getExtendedInstance();

    const histRows = await extDb.query<any>(`
        SELECT * FROM dbo.daftar_upah_aggregation_history
        WHERE period_month = ? AND period_year = ? AND gang_code = ?
        ORDER BY id DESC
    `, [month, year, testGang]);

    console.log(`History records found: ${histRows.length}\n`);

    if (histRows.length === 0) {
        console.log("⚠️ No aggregation history found for this gang!");
        return;
    }

    // Use latest record (highest id)
    const hist = histRows[0];
    console.log(`Using history record ID: ${hist.id}, version: ${hist.version_index || 'N/A'}\n`);

    const histTotal = {
        employees: hist.total_employees || 0,
        total_hk: hist.total_hk || 0,
        gaji_pokok: 0, // Not stored in history header
        beras_jumlah: hist.total_beras || 0,
        jabatan_jumlah: hist.total_jabatan || 0,
        masa_kerja_jumlah: hist.total_masa_kerja || 0,
        lembur_jumlah: hist.total_lembur || 0,
        total_tunjangan: hist.total_tunjangan || 0,
        premi_brondol: hist.total_premi_brondol || 0,
        premi_pruning: hist.total_premi_prunning || 0,
        total_premi: hist.total_premi || 0,
        pot_pph21: hist.total_pph21 || 0,
        pot_spsi: hist.total_spsi || 0,
        pot_bpjs_pekerja_total: hist.total_bpjs_pekerja || 0,
        pot_koreksi: hist.total_koreksi || 0,
        total_potongan: hist.total_potongan || 0,
        jumlah_upah_kotor: hist.total_upah_kotor || 0,
        upah_bersih: hist.total_upah_bersih || 0,
    };

    // ===== 3. Compare =====
    console.log("=== COMPARISON TABLE ===\n");

    const fields = [
        { key: 'employees', label: 'Employee Count' },
        { key: 'total_hk', label: 'Total HK' },
        { key: 'beras_jumlah', label: 'Beras' },
        { key: 'jabatan_jumlah', label: 'Jabatan' },
        { key: 'masa_kerja_jumlah', label: 'Masa Kerja' },
        { key: 'lembur_jumlah', label: 'Lembur' },
        { key: 'total_tunjangan', label: 'Total Tunjangan' },
        { key: 'premi_brondol', label: 'Premi Brondol' },
        { key: 'premi_pruning', label: 'Premi Pruning' },
        { key: 'total_premi', label: 'Total Premi' },
        { key: 'pot_pph21', label: 'PPh21' },
        { key: 'pot_spsi', label: 'SPSI' },
        { key: 'pot_bpjs_pekerja_total', label: 'BPJS Pekerja' },
        { key: 'pot_koreksi', label: 'Koreksi' },
        { key: 'total_potongan', label: 'Total Potongan' },
        { key: 'jumlah_upah_kotor', label: 'Upah Kotor' },
        { key: 'upah_bersih', label: 'Upah Bersih' },
    ];

    let hasDiff = false;
    console.log(`| Field | Daftar Upah (Live) | Aggregation History | Difference |`);
    console.log(`|-------|-------------------|---------------------|------------|`);

    for (const field of fields) {
        const liveVal = liveTotal[field.key as keyof typeof liveTotal] || 0;
        const histVal = histTotal[field.key as keyof typeof histTotal] || 0;
        const diff = liveVal - histVal;
        const isDiff = Math.abs(diff) > 1; // Allow 1 rupiah rounding difference

        if (isDiff) hasDiff = true;

        const marker = isDiff ? ' ⚠️' : ' ✅';
        console.log(`| ${field.label} | ${liveVal.toLocaleString('id-ID')} | ${histVal.toLocaleString('id-ID')} | ${diff > 0 ? '+' : ''}${diff.toLocaleString('id-ID')} |${marker}`);
    }

    console.log(`\n${hasDiff ? '⚠️ DIFFERENCES FOUND!' : '✅ Values match!'}`);

    // ===== 4. Check employee list differences =====
    if (liveRows.length !== histTotal.employees) {
        console.log(`\n🔍 Employee count mismatch: Live=${liveRows.length}, History=${histTotal.employees}`);

        const liveEmpCodes = new Set(liveRows.map(r => r.emp_code));
        const histEmpCodes = new Set<string>();

        // Get employee codes from history detail
        const histDetails = await extDb.query<any>(`
            SELECT emp_code FROM dbo.payroll_history_detail
            WHERE history_id IN (
                SELECT history_id FROM dbo.payroll_history_master
                WHERE period_month = ? AND period_year = ? AND gang_code = ?
            )
        `, [month, year, testGang]);

        for (const d of histDetails) {
            histEmpCodes.add(d.emp_code?.trim() || '');
        }

        const onlyInLive = [...liveEmpCodes].filter(e => !histEmpCodes.has(e));
        const onlyInHist = [...histEmpCodes].filter(e => !liveEmpCodes.has(e));

        if (onlyInLive.length > 0) {
            console.log(`  Only in Live (${onlyInLive.length}): ${onlyInLive.slice(0, 10).join(', ')}${onlyInLive.length > 10 ? '...' : ''}`);
        }
        if (onlyInHist.length > 0) {
            console.log(`  Only in History (${onlyInHist.length}): ${onlyInHist.slice(0, 10).join(', ')}${onlyInHist.length > 10 ? '...' : ''}`);
        }
    }
}

main().catch(console.error);
