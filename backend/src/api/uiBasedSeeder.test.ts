import { describe, expect, it } from "bun:test";
import { calculateGangAggregation } from "./uiBasedSeeder";

describe("uiBasedSeeder calculateGangAggregation", () => {
    it("uses the same active-row and deduction totals as Daftar Upah", () => {
        const record = calculateGangAggregation("A01", [
            {
                gang_code: "A01",
                jumlah_hk: 20,
                hari_kerja: 18,
                upah_dasar: 100,
                upah_pokok: 900,
                gaji_pokok: 1000,
                pot_pph21: 10,
                pot_bpjs_kesehatan_pekerja: 11,
                pot_bpjs_pensiun_pekerja: 12,
                pot_bpjs_kesehatan_majikan: 13,
                pot_bpjs_pensiun_majikan: 14,
                pot_spsi: 7,
                total_potongan: 30,
                jumlah_upah_kotor: 2000,
                upah_bersih: 1900
            },
            {
                gang_code: "A01",
                jumlah_hk: 0,
                hari_kerja: 0,
                upah_pokok: 999999,
                gaji_pokok: 999999,
                pot_pph21: 999999,
                pot_bpjs_kesehatan_pekerja: 999999,
                pot_spsi: 999999,
                total_potongan: 999999,
                jumlah_upah_kotor: 999999,
                upah_bersih: 999999
            }
        ]);

        expect(record.total_employees).toBe(1);
        expect(record.total_hk).toBe(20);
        expect(record.total_pph21).toBe(10);
        expect(record.total_bpjs_pekerja).toBe(23);
        expect(record.total_bpjs_majikan).toBe(27);
        expect(record.total_spsi).toBe(7);
        expect(record.total_upah_bersih).toBe(1900);
    });
});
