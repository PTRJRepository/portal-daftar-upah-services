import { describe, expect, test } from "bun:test";
import { calculateTaxMatrixTotals } from "./payrollTotalsCalculator";

describe("calculateTaxMatrixTotals", () => {
    test("returns zeroed totals for empty input", () => {
        const totals = calculateTaxMatrixTotals([]);

        expect(totals.employee_count).toBe(0);
        expect(totals.gaji_pokok_bulanan).toBe(0);
        expect(totals.penghasilan_bruto).toBe(0);
        expect(totals.pph21_ter).toBe(0);
    });

    test("sums tax-matrix fields from backend rows", () => {
        const totals = calculateTaxMatrixTotals([
            {
                gaji_pokok_bulanan: 1000,
                gaji_pokok_ideal: 1200,
                gaji_pokok_dibayarkan: 900,
                koreksi_hk: -100,
                astek_084: 10,
                bpjs_kesehatan_majikan_4_pct: 40,
                beras_jumlah: 50,
                jabatan_jumlah: 60,
                masa_kerja_jumlah: 70,
                lembur_jumlah: 80,
                total_premi: 90,
                pot_koreksi: 30,
                taxable_pendapatan_thr: 300,
                taxable_pendapatan_bonus: 200,
                taxable_pendapatan_custom: 100,
                taxable_pendapatan_lainnya: 600,
                penghasilan_bruto: 1700,
                pph21_ter: 17,
                pot_astek_pekerja: 20,
                pot_bpjs_kesehatan_pekerja: 10,
                pot_bpjs_pensiun_pekerja: 5,
                pot_astek_jumlah: 35,
                pot_spsi: 2,
                pot_pph21: 16
            },
            {
                gaji_pokok_bulanan: 2000,
                gaji_pokok_ideal: 2100,
                gaji_pokok_dibayarkan: 1800,
                koreksi_hk: -200,
                astek_084: 20,
                bpjs_kesehatan_majikan_4_pct: 80,
                beras_jumlah: 70,
                jabatan_jumlah: 90,
                masa_kerja_jumlah: 110,
                lembur_jumlah: 130,
                total_premi: 150,
                pot_koreksi: 60,
                taxable_pendapatan_thr: 400,
                taxable_pendapatan_bonus: 500,
                taxable_pendapatan_custom: 0,
                taxable_pendapatan_lainnya: 900,
                penghasilan_bruto: 3100,
                pph21_ter: 31,
                pot_astek_pekerja: 40,
                pot_bpjs_kesehatan_pekerja: 20,
                pot_bpjs_pensiun_pekerja: 10,
                pot_astek_jumlah: 70,
                pot_spsi: 3,
                pot_pph21: 30
            }
        ]);

        expect(totals.employee_count).toBe(2);
        expect(totals.gaji_pokok_bulanan).toBe(3000);
        expect(totals.koreksi_hk).toBe(-300);
        expect(totals.total_premi).toBe(240);
        expect(totals.taxable_pendapatan_lainnya).toBe(1500);
        expect(totals.penghasilan_bruto).toBe(4800);
        expect(totals.pph21_ter).toBe(48);
        expect(totals.pot_pph21).toBe(46);
    });
});
