/**
 * PARALLEL UI-BASED AGGREGATION SEEDER
 * 
 * Seeds aggregation based on LIVE UI data (dataExtractorService)
 * - Processes all groups (gangPrefix) in parallel
 * - Seeds ALL gangs simultaneously
 * - Uses exact same filtering as live Daftar Upah
 * - DELETE before INSERT to prevent duplication
 * 
 * Usage: cd backend && bun run _dev_utils/scripts/debugging/ui_based_seeder.ts
 */

import { dataExtractorService } from "../../../src/services/dataExtractorService";
import { Database } from "../../../src/db/client";

interface GangAggRecord {
    gang_code: string;
    gang_description: string;
    total_employees: number;
    total_hk: number;
    total_hari_kerja: number;
    total_cuti_tahunan: number;
    total_cuti_sakit: number;
    total_cuti_minggu: number;
    total_cuti_nasional: number;
    total_upah_dasar: number;
    total_upah_pokok: number;
    total_gaji_pokok: number;
    total_beras: number;
    total_jabatan: number;
    total_masa_kerja: number;
    total_lembur: number;
    total_tunjangan: number;
    total_premi_brondol: number;
    total_premi_prunning: number;
    total_premi_insentif: number;
    total_premi_kinerja: number;
    total_premi: number;
    total_potongan: number;
    total_pph21: number;
    total_bpjs_pekerja: number;
    total_bpjs_majikan: number;
    total_spsi: number;
    total_upah_kotor: number;
    total_upah_bersih: number;
    total_ffb_weight: number;
    total_weight_tbs: number;
    dynamic_premi_data: string;
    informasi_tambahan: string;
    total_koreksi: number;
}

const DIVISIONS = [
    { code: "P1A", name: "Parit Gunung 1A" },
    { code: "P1B", name: "Parit Gunung 1B" },
    { code: "P2A", name: "Parit Gunung 2A" },
    { code: "P2B", name: "Parit Gunung 2B" },
    { code: "DME", name: "Kebun DME" },
    { code: "ARA", name: "Kebun ARA" },
    { code: "ARB1", name: "Air Ruak B1" },
    { code: "ARB2", name: "Air Ruak B2" },
    { code: "INF", name: "Infrastruktur" },
    { code: "ARC", name: "Air Ruak Central" },
    { code: "IJL", name: "Kebun IJL" },
    { code: "NRS", name: "Nursery" },
];

const GROUPS = ["1", "2", "3"];

async function seedDivision(division: string, month: number, year: number): Promise<{ division: string, gangs: number, employees: number, status: string }> {
    try {
        // Fetch LIVE data using SAME method as Daftar Upah UI (ALL groups)
        const result = await dataExtractorService.extractPayrollData(
            month, year, "ALL", division, null, "SERVER_PROFILE_2",
            false,  // includeVirtual
            false,  // useHistoryDb
            null,   // gangPrefix - NO group filter
            true    // skipHarvest (for speed)
        );

        const rows = result.data_rows || [];
        if (rows.length === 0) {
            return { division, gangs: 0, employees: 0, status: "SKIPPED (no data)" };
        }

        // Group by gang
        const gangsMap: Record<string, any[]> = {};
        for (const row of rows) {
            const gc = row.gang_code || "UNKNOWN";
            if (!gangsMap[gc]) gangsMap[gc] = [];
            gangsMap[gc].push(row);
        }

        const extDb = Database.getExtendedInstance();

        for (const [gangCode, employees] of Object.entries(gangsMap)) {
            // Calculate totals EXACTLY as payrollDataService does
            const totals = calculateTotals(employees);

            // Build aggregation record
            const record: GangAggRecord = {
                gang_code: gangCode,
                gang_description: employees[0]?.gang_description || gangCode,
                total_employees: employees.length,
                total_hk: totals.jumlah_hk,
                total_hari_kerja: totals.hari_kerja,
                total_cuti_tahunan: 0,
                total_cuti_sakit: 0,
                total_cuti_minggu: 0,
                total_cuti_nasional: 0,
                total_upah_dasar: 0,
                total_upah_pokok: totals.gaji_pokok,
                total_gaji_pokok: totals.gaji_pokok,
                total_beras: totals.beras_jumlah,
                total_jabatan: totals.jabatan_jumlah,
                total_masa_kerja: totals.masa_kerja_jumlah,
                total_lembur: totals.lembur_jumlah,
                total_tunjangan: totals.total_tunjangan,
                total_premi_brondol: totals.premi_brondol,
                total_premi_prunning: 0,
                total_premi_insentif: 0,
                total_premi_kinerja: 0,
                total_premi: totals.total_premi,
                total_potongan: totals.total_potongan,
                total_pph21: totals.pot_pph21,
                total_bpjs_pekerja: totals.pot_bpjs_pekerja_total,
                total_bpjs_majikan: totals.pot_astek_maj,
                total_spsi: totals.pot_spsi,
                total_upah_kotor: totals.jumlah_upah_kotor,
                total_upah_bersih: totals.upah_bersih,
                total_ffb_weight: 0,
                total_weight_tbs: 0,
                dynamic_premi_data: JSON.stringify([]),
                informasi_tambahan: "",
                total_koreksi: totals.pot_koreksi,
            };

            // DELETE existing record to prevent duplication
            await extDb.query(`
                DELETE FROM dbo.daftar_upah_aggregation_history
                WHERE period_month = ? AND period_year = ? AND gang_code = ?
            `, [month, year, gangCode]);

            // INSERT new record
            await extDb.query(`
                INSERT INTO dbo.daftar_upah_aggregation_history (
                    period_month, period_year, division_code, gang_code, gang_description,
                    total_employees, total_hk, total_hari_kerja,
                    total_cuti_tahunan, total_cuti_sakit, total_cuti_minggu, total_cuti_nasional,
                    total_upah_dasar, total_upah_pokok, total_gaji_pokok,
                    total_beras, total_jabatan, total_masa_kerja, total_lembur, total_tunjangan,
                    total_premi_brondol, total_premi_prunning, total_premi_insentif, total_premi_kinerja, total_premi,
                    total_potongan, total_pph21, total_bpjs_pekerja, total_bpjs_majikan, total_spsi,
                    total_upah_kotor, total_upah_bersih, total_ffb_weight, total_weight_tbs,
                    dynamic_premi_data, informasi_tambahan, total_koreksi,
                    created_at, updated_at, source_endpoint
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, GETDATE(), GETDATE(), ?
                )
            `, [
                month, year, division,
                record.gang_code, record.gang_description,
                record.total_employees, record.total_hk, record.total_hari_kerja,
                record.total_cuti_tahunan, record.total_cuti_sakit, record.total_cuti_minggu, record.total_cuti_nasional,
                record.total_upah_dasar, record.total_upah_pokok, record.total_gaji_pokok,
                record.total_beras, record.total_jabatan, record.total_masa_kerja, record.total_lembur, record.total_tunjangan,
                record.total_premi_brondol, record.total_premi_prunning, record.total_premi_insentif, record.total_premi_kinerja, record.total_premi,
                record.total_potongan, record.total_pph21, record.total_bpjs_pekerja, record.total_bpjs_majikan, record.total_spsi,
                record.total_upah_kotor, record.total_upah_bersih, record.total_ffb_weight, record.total_weight_tbs,
                record.dynamic_premi_data, record.informasi_tambahan, record.total_koreksi,
                'ui_based_seeder'
            ]);
        }

        return {
            division,
            gangs: Object.keys(gangsMap).length,
            employees: rows.length,
            status: "SUCCESS"
        };
    } catch (error: any) {
        return {
            division,
            gangs: 0,
            employees: 0,
            status: `ERROR: ${error.message}`
        };
    }
}

function calculateTotals(employees: any[]) {
    const totals: Record<string, number> = {};
    const numericFields = [
        'jumlah_hk', 'hari_kerja', 'gaji_pokok', 'gaji_pokok_ideal', 'gaji_pokok_aktual',
        'beras_jumlah', 'jabatan_jumlah', 'masa_kerja_tahun', 'masa_kerja_jumlah', 'lembur_jumlah',
        'total_tunjangan', 'premi_brondol', 'total_premi', 'pot_koreksi',
        'potongan_upah_kotor_total', 'jumlah_upah_kotor',
        'pot_astek', 'pot_astek_maj', 'pot_bpjs_kesehatan_pekerja', 'pot_bpjs_kesehatan_majikan',
        'pot_bpjs_pensiun_pekerja', 'pot_bpjs_pensiun_majikan', 'pot_bpjs_pekerja_total',
        'pot_spsi', 'pot_pph21', 'premi_pph', 'total_potongan', 'total_potongan_bersih',
        'upah_bersih', 'koreksi_hk', 'pph21_ter', 'tarif_pajak_ter'
    ];

    for (const field of numericFields) totals[field] = 0;

    for (const emp of employees) {
        for (const field of numericFields) {
            const val = emp[field];
            if (val !== null && val !== undefined) totals[field] += parseFloat(val) || 0;
        }
    }
    return totals;
}

async function main() {
    const month = 3;
    const year = 2026;
    const PARALLEL_BATCH = 4; // Process 4 div-group combos at once

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🚀 UI-BASED AGGREGATION SEEDER`);
    console.log(`📅 Period: ${month}/${year}`);
    console.log(`⚡ Mode: PARALLEL (${PARALLEL_BATCH} batches)`);
    console.log(`${'='.repeat(70)}\n`);

    const startTime = Date.now();

    // Build tasks - one per division (ALL groups at once)
    const tasks = DIVISIONS.map(d => d.code);

    console.log(`Total tasks: ${tasks.length} divisions\n`);

    // Process in parallel batches
    let successCount = 0;
    let errorCount = 0;
    let totalGangs = 0;
    let totalEmployees = 0;

    for (let i = 0; i < tasks.length; i += PARALLEL_BATCH) {
        const batch = tasks.slice(i, i + PARALLEL_BATCH);
        const batchNum = Math.floor(i / PARALLEL_BATCH) + 1;
        const totalBatches = Math.ceil(tasks.length / PARALLEL_BATCH);

        console.log(`📦 Batch ${batchNum}/${totalBatches}: [${batch.join(', ')}]`);
        const batchStart = Date.now();

        const results = await Promise.allSettled(
            batch.map(t => seedDivision(t, month, year))
        );

        for (const result of results) {
            if (result.status === 'fulfilled') {
                const r = result.value;
                const marker = r.status === "SUCCESS" ? '✅' : '⏭️';
                console.log(`  ${marker} ${r.division}: ${r.gangs} gangs, ${r.employees} emp - ${r.status}`);
                if (r.status === "SUCCESS") {
                    successCount++;
                    totalGangs += r.gangs;
                    totalEmployees += r.employees;
                } else {
                    errorCount++;
                }
            } else {
                console.log(`  ❌ Batch error: ${result.reason}`);
                errorCount++;
            }
        }

        const batchTime = ((Date.now() - batchStart) / 1000).toFixed(1);
        console.log(`  ⏱️  ${batchTime}s\n`);
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`${'='.repeat(70)}`);
    console.log(`✅ SEEDING COMPLETE!`);
    console.log(`   Divisions: ${successCount}/${tasks.length} succeeded`);
    console.log(`   Gangs seeded: ${totalGangs}`);
    console.log(`   Employees processed: ${totalEmployees}`);
    console.log(`   Time: ${totalTime}s (${(totalTime / 60).toFixed(1)} min)`);
    console.log(`${'='.repeat(70)}\n`);
}

main().catch(console.error);
