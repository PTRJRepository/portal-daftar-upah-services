import { describe, expect, test } from "bun:test";
import { rowToPayrollCalculatorInput } from "./aggregationAdapter";

describe("rowToPayrollCalculatorInput", () => {
    test("uses total_tunjangan as authoritative when present", () => {
        const input = rowToPayrollCalculatorInput({
            gaji_pokok: 1_000_000,
            total_tunjangan: 400_000,
            beras_jumlah: 100_000,
            jabatan_jumlah: 100_000,
            masa_kerja_jumlah: 100_000,
            lembur_jumlah: 100_000,
            total_premi: 200_000,
        });

        expect(input.total_tunjangan).toBe(400_000);
    });

    test("derives total_tunjangan from components when total is missing", () => {
        const input = rowToPayrollCalculatorInput({
            gaji_pokok: 1_000_000,
            beras_jumlah: 120_000,
            jabatan_jumlah: 80_000,
            masa_kerja_jumlah: 50_000,
            lembur_jumlah: 30_000,
            total_premi: 200_000,
        });

        expect(input.total_tunjangan).toBe(280_000);
    });

    test("does not double count premi fallback", () => {
        const input = rowToPayrollCalculatorInput({
            gaji_pokok: 1_000_000,
            beras_jumlah: 100_000,
            jabatan_jumlah: 100_000,
            masa_kerja_jumlah: 100_000,
            lembur_jumlah: 100_000,
            total_tunjangan: 400_000,
            // no total_premi -> fallback from components
            premi_brondol: 75_000,
            premi_pruning: 25_000,
        });

        expect(input.total_premi).toBe(100_000);
    });

    test("normalizes koreksi to absolute deduction amount", () => {
        const input = rowToPayrollCalculatorInput({
            gaji_pokok: 1_000_000,
            total_tunjangan: 0,
            total_premi: 0,
            pot_koreksi: -50_000,
        });

        expect(input.pot_koreksi).toBe(50_000);
    });
});
