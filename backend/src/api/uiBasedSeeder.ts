/**
 * SEEDER BERBASIS UI - Mengekstrak data PERSIS seperti yang tampil di Daftar Upah
 * 
 * Menggunakan parameter yang SAMA dengan UI:
 * - Division (dari filter UI)
 * - Month/Year (dari period slider)
 * - Gang (jika dipilih)
 * - GangPrefix/Group (jika dipilih)
 * 
 * Hasil: Agregasi yang 100% MATCH dengan Daftar Upah
 */

import { Database } from "../db/client";
import { dataExtractorService } from "../services/dataExtractorService";
import { divisionDefinition } from "../services/divisionDefinition";

interface SeedResult {
    gang_code: string;
    employees: number;
    upah_bersih: number;
    status: 'success' | 'error';
    error?: string;
}

interface GrandTotal {
    total_employees: number;
    total_hk: number;
    total_hari_kerja: number;
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
    total_koreksi: number;
    total_upah_kotor: number;
    total_potongan: number;
    total_pph21: number;
    total_bpjs_kes_pekerja: number;
    total_bpjs_kes_majikan: number;
    total_bpjs_pensiun_pekerja: number;
    total_bpjs_pensiun_majikan: number;
    total_spsi: number;
    total_upah_bersih: number;
    // Dynamic premi totals
    dynamic_premi_1: number;
    dynamic_premi_2: number;
    dynamic_premi_3: number;
    dynamic_premi_4: number;
    dynamic_premi_5: number;
    dynamic_premi_6: number;
    dynamic_premi_7: number;
}

export async function seedFromUI(
    division: string,
    month: number,
    year: number,
    gangCode: string | null = null,
    gangPrefix: string | null = null
): Promise<{ success: boolean; results: SeedResult[]; total_gangs: number; total_employees: number; grand_total: GrandTotal }> {

    console.log(`🎨 UI-BASED SEEDER`);
    console.log(`   Division: ${division}`);
    console.log(`   Period: ${month}/${year}`);
    console.log(`   Gang: ${gangCode || 'ALL'}`);
    console.log(`   Group: ${gangPrefix || 'ALL'}`);
    console.log();

    const extDb = Database.getExtendedInstance();
    const results: SeedResult[] = [];

    try {
        // Step 1: Fetch data EXACTLY like UI does
        // This uses the SAME dataExtractorService with SAME parameters as Daftar Upah
        const result = await dataExtractorService.extractPayrollData(
            month,
            year,
            gangCode || "ALL",
            division,
            null,
            "SERVER_PROFILE_2",
            false,   // includeVirtual - SAME as UI
            false,   // useHistoryDb - SAME as UI
            gangPrefix, // gangPrefix/group - SAME as UI filter
            true     // skipHarvest - for speed (panen data not needed for summary)
        );

        const rows = result.data_rows || [];
        console.log(`📊 Fetched ${rows.length} employees from UI data\n`);

        if (rows.length === 0) {
            return { success: false, results: [], total_gangs: 0, total_employees: 0, grand_total: createEmptyGrandTotal() };
        }

        // Step 2: Group by gang (exactly as displayed in UI)
        const gangsMap: Record<string, any[]> = {};
        for (const row of rows) {
            const gc = row.gang_code || "UNKNOWN";
            if (!gangsMap[gc]) gangsMap[gc] = [];
            gangsMap[gc].push(row);
        }

        console.log(`📋 Found ${Object.keys(gangsMap).length} gangs\n`);

        // Step 3: Calculate grand total across ALL gangs first
        const grandTotal = calculateGrandTotal(rows);

        console.log(`📊 GRAND TOTAL:`);
        console.log(`   Employees: ${grandTotal.total_employees}`);
        console.log(`   Total HK: ${grandTotal.total_hk}`);
        console.log(`   Gaji Pokok: ${grandTotal.total_gaji_pokok.toLocaleString('id-ID')}`);
        console.log(`   Total Tunjangan: ${grandTotal.total_tunjangan.toLocaleString('id-ID')}`);
        console.log(`   Total Premi: ${grandTotal.total_premi.toLocaleString('id-ID')}`);
        console.log(`   Total Potongan: ${grandTotal.total_potongan.toLocaleString('id-ID')}`);
        console.log(`   Upah Bersih: ${grandTotal.total_upah_bersih.toLocaleString('id-ID')}`);

        // Step 3: Calculate totals EXACTLY as shown in UI
        for (const [gangCode, employees] of Object.entries(gangsMap)) {
            try {
                // Calculate totals from employee data (same as payrollDataService but using UI data)
                const totals = calculateUITotals(employees);

                console.log(`  Gang ${gangCode}: ${employees.length} emp | bersih: ${totals.upah_bersih.toLocaleString('id-ID')}`);

                // Step 4: DELETE existing record to prevent duplication
                await extDb.query(`
                    DELETE FROM dbo.daftar_upah_aggregation_history
                    WHERE period_month = ? AND period_year = ? AND gang_code = ?
                `, [month, year, gangCode]);

                // Step 5: INSERT new record with UI-calculated values
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
                    gangCode, employees[0]?.gang_description || gangCode,
                    employees.length, totals.jumlah_hk, totals.hari_kerja,
                    0, 0, 0, 0,
                    0, totals.gaji_pokok, totals.gaji_pokok,
                    totals.beras_jumlah, totals.jabatan_jumlah, totals.masa_kerja_jumlah, totals.lembur_jumlah, totals.total_tunjangan,
                    totals.premi_brondol, 0, 0, 0, totals.total_premi,
                    totals.total_potongan, totals.pot_pph21, totals.pot_bpjs_pekerja_total, 0, totals.pot_spsi,
                    totals.jumlah_upah_kotor, totals.upah_bersih, 0, 0,
                    JSON.stringify([]), "", totals.pot_koreksi,
                    'ui_based_seeder'
                ]);

                results.push({
                    gang_code: gangCode,
                    employees: employees.length,
                    upah_bersih: totals.upah_bersih,
                    status: 'success'
                });
            } catch (error: any) {
                console.error(`  ❌ Error seeding ${gangCode}: ${error.message}`);
                results.push({
                    gang_code: gangCode,
                    employees: 0,
                    upah_bersih: 0,
                    status: 'error',
                    error: error.message
                });
            }
        }

        // Step 6: INSERT grand total record for the division (ALL gangs combined)
        try {
            console.log(`\n📊 Inserting grand total for division ${division}...`);

            // Delete existing division grand total record
            await extDb.query(`
                DELETE FROM dbo.daftar_upah_aggregation_history
                WHERE period_month = ? AND period_year = ? AND gang_code = ?
            `, [month, year, `DIVISI_${division}`]);

            // Insert grand total
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
                    ?, ?, ?, GETDATE(), GETDATE(), ?
                )
            `, [
                month, year, division,
                `DIVISI_${division}`, `GRAND TOTAL - ${division}`,
                grandTotal.total_employees, grandTotal.total_hk, grandTotal.total_hari_kerja,
                0, 0, 0, 0,
                0, grandTotal.total_gaji_pokok, grandTotal.total_gaji_pokok,
                grandTotal.total_beras, grandTotal.total_jabatan, grandTotal.total_masa_kerja,
                grandTotal.total_lembur, grandTotal.total_tunjangan,
                grandTotal.total_premi_brondol, grandTotal.total_premi_prunning,
                grandTotal.total_premi_insentif, grandTotal.total_premi_kinerja, grandTotal.total_premi,
                grandTotal.total_potongan, grandTotal.total_pph21,
                grandTotal.total_bpjs_kes_pekerja, grandTotal.total_bpjs_kes_majikan, grandTotal.total_spsi,
                grandTotal.total_upah_kotor, grandTotal.total_upah_bersih, 0, 0,
                JSON.stringify({
                    dynamic_premi_1: grandTotal.dynamic_premi_1,
                    dynamic_premi_2: grandTotal.dynamic_premi_2,
                    dynamic_premi_3: grandTotal.dynamic_premi_3,
                    dynamic_premi_4: grandTotal.dynamic_premi_4,
                    dynamic_premi_5: grandTotal.dynamic_premi_5,
                    dynamic_premi_6: grandTotal.dynamic_premi_6,
                    dynamic_premi_7: grandTotal.dynamic_premi_7
                }),
                `Grand Total for Division ${division}`,
                grandTotal.total_koreksi,
                'ui_based_seeder_grand_total'
            ]);

            console.log(`✅ Grand total inserted for division ${division}`);
        } catch (error: any) {
            console.error(`❌ Error inserting grand total: ${error.message}`);
        }

        const successCount = results.filter(r => r.status === 'success').length;
        const totalEmployees = results.reduce((sum, r) => sum + r.employees, 0);

        console.log(`\n✅ Seeding complete: ${successCount}/${results.length} gangs, ${totalEmployees} employees`);

        return {
            success: successCount > 0,
            results,
            total_gangs: successCount,
            total_employees: totalEmployees,
            grand_total: grandTotal
        };
    } catch (error: any) {
        console.error(`❌ Seeder error: ${error.message}`);
        return {
            success: false,
            results,
            total_gangs: 0,
            total_employees: 0,
            grand_total: createEmptyGrandTotal()
        };
    }
}

/**
 * Calculate totals EXACTLY as displayed in UI
 * This matches the UI calculation logic 100%
 */
function calculateUITotals(employees: any[]) {
    const totals: Record<string, number> = {
        jumlah_hk: 0,
        hari_kerja: 0,
        gaji_pokok: 0,
        beras_jumlah: 0,
        jabatan_jumlah: 0,
        masa_kerja_jumlah: 0,
        lembur_jumlah: 0,
        total_tunjangan: 0,
        premi_brondol: 0,
        total_premi: 0,
        pot_koreksi: 0,
        jumlah_upah_kotor: 0,
        total_potongan: 0,
        pot_pph21: 0,
        pot_bpjs_pekerja_total: 0,
        pot_spsi: 0,
        upah_bersih: 0
    };

    for (const emp of employees) {
        totals.jumlah_hk += emp.jumlah_hk || 0;
        totals.hari_kerja += emp.hari_kerja || 0;
        totals.gaji_pokok += emp.gaji_pokok || 0;
        totals.beras_jumlah += emp.beras_jumlah || 0;
        totals.jabatan_jumlah += emp.jabatan_jumlah || 0;
        totals.masa_kerja_jumlah += emp.masa_kerja_jumlah || 0;
        totals.lembur_jumlah += emp.lembur_jumlah || 0;
        totals.total_tunjangan += emp.total_tunjangan || 0;
        totals.premi_brondol += emp.premi_brondol || 0;
        totals.total_premi += emp.total_premi || 0;
        totals.pot_koreksi += emp.pot_koreksi || 0;
        totals.jumlah_upah_kotor += emp.jumlah_upah_kotor || 0;
        totals.total_potongan += emp.total_potongan || 0;
        totals.pot_pph21 += emp.pot_pph21 || 0;
        totals.pot_bpjs_pekerja_total += emp.pot_bpjs_pekerja_total || 0;
        totals.pot_spsi += emp.pot_spsi || 0;
        totals.upah_bersih += emp.upah_bersih || 0;
    }

    return totals;
}

/**
 * Create empty grand total object
 */
function createEmptyGrandTotal(): GrandTotal {
    return {
        total_employees: 0,
        total_hk: 0,
        total_hari_kerja: 0,
        total_gaji_pokok: 0,
        total_beras: 0,
        total_jabatan: 0,
        total_masa_kerja: 0,
        total_lembur: 0,
        total_tunjangan: 0,
        total_premi_brondol: 0,
        total_premi_prunning: 0,
        total_premi_insentif: 0,
        total_premi_kinerja: 0,
        total_premi: 0,
        total_koreksi: 0,
        total_upah_kotor: 0,
        total_potongan: 0,
        total_pph21: 0,
        total_bpjs_kes_pekerja: 0,
        total_bpjs_kes_majikan: 0,
        total_bpjs_pensiun_pekerja: 0,
        total_bpjs_pensiun_majikan: 0,
        total_spsi: 0,
        total_upah_bersih: 0,
        dynamic_premi_1: 0,
        dynamic_premi_2: 0,
        dynamic_premi_3: 0,
        dynamic_premi_4: 0,
        dynamic_premi_5: 0,
        dynamic_premi_6: 0,
        dynamic_premi_7: 0
    };
}

/**
 * Calculate grand total across all employees (aggregated across all gangs)
 * Matches the aggregation table schema exactly
 */
function calculateGrandTotal(employees: any[]): GrandTotal {
    const grand: GrandTotal = createEmptyGrandTotal();

    for (const emp of employees) {
        // Basic counts
        grand.total_employees += 1;
        grand.total_hk += emp.jumlah_hk || 0;
        grand.total_hari_kerja += emp.hari_kerja || 0;

        // Gaji Pokok
        grand.total_gaji_pokok += emp.gaji_pokok || 0;

        // Tunjangan components
        grand.total_beras += emp.beras_jumlah || 0;
        grand.total_jabatan += emp.jabatan_jumlah || 0;
        grand.total_masa_kerja += emp.masa_kerja_jumlah || 0;
        grand.total_lembur += emp.lembur_jumlah || 0;
        grand.total_tunjangan += emp.total_tunjangan || 0;

        // Premi components
        grand.total_premi_brondol += emp.premi_brondol || 0;
        grand.total_premi_prunning += emp.premi_prunning || 0;
        grand.total_premi_insentif += emp.premi_insentif || 0;
        grand.total_premi_kinerja += emp.premi_kinerja || 0;
        grand.total_premi += emp.total_premi || 0;

        // Dynamic premi
        grand.dynamic_premi_1 += emp.premi_dynamic_1 || 0;
        grand.dynamic_premi_2 += emp.premi_dynamic_2 || 0;
        grand.dynamic_premi_3 += emp.premi_dynamic_3 || 0;
        grand.dynamic_premi_4 += emp.premi_dynamic_4 || 0;
        grand.dynamic_premi_5 += emp.premi_dynamic_5 || 0;
        grand.dynamic_premi_6 += emp.premi_dynamic_6 || 0;
        grand.dynamic_premi_7 += emp.premi_dynamic_7 || 0;

        // Koreksi
        grand.total_koreksi += emp.pot_koreksi || 0;

        // Upah Kotor
        grand.total_upah_kotor += emp.jumlah_upah_kotor || 0;

        // Potongan components
        grand.total_potongan += emp.total_potongan || 0;
        grand.total_pph21 += emp.pot_pph21 || 0;
        grand.total_bpjs_kes_pekerja += emp.bpjs_kes_pekerja || emp.pot_bpjs_kesehatan_pekerja || emp.bpjs_pek || 0;
        grand.total_bpjs_kes_majikan += emp.bpjs_kes_majikan || emp.pot_bpjs_kesehatan_majikan || emp.bpjs_maj || 0;
        grand.total_bpjs_pensiun_pekerja += emp.bpjs_pensiun_pekerja || emp.pot_bpjs_pensiun_pekerja || 0;
        grand.total_bpjs_pensiun_majikan += emp.bpjs_pensiun_majikan || emp.pot_bpjs_pensiun_majikan || 0;
        grand.total_spsi += emp.pot_spsi || 0;

        // Upah Bersih
        grand.total_upah_bersih += emp.upah_bersih || 0;
    }

    return grand;
}
