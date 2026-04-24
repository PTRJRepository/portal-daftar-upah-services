import { describe, expect, it } from "bun:test";
import { buildAutoBufferSeedEntries } from "./autoBufferManualAdjustmentSeederService";

describe("autoBufferManualAdjustmentSeederService", () => {
    it("builds 3 AUTO_BUFFER entries per employee", () => {
        const entries = buildAutoBufferSeedEntries([
            {
                emp_code: "A0001",
                gang_code: "AB1",
                jabatan_estate: "Mandor 1",
                hari_kerja: 24,
                jumlah_hk: 24,
                masa_kerja_tahun: 5,
                is_spsi_member: true,
                jabatan_jumlah: 0,
                masa_kerja_jumlah: 0
            }
        ], 4, 2026, "AB1");

        expect(entries.length).toBe(3);
        expect(entries.every((entry) => entry.adjustment_type === "AUTO_BUFFER")).toBe(true);
        expect(entries.map((entry) => entry.adjustment_name).sort()).toEqual([
            "AUTO MASA KERJA",
            "AUTO SPSI",
            "AUTO TUNJANGAN JABATAN"
        ]);

        const spsiEntry = entries.find((entry) => entry.adjustment_name === "AUTO SPSI");
        expect(Number(spsiEntry?.amount || 0)).toBe(4000);
    });

    it("forces jabatan amount to zero for karyawan role", () => {
        const entries = buildAutoBufferSeedEntries([
            {
                emp_code: "A0002",
                gang_code: "AB1",
                jabatan_estate: "Karyawan Panen",
                hari_kerja: 25,
                jumlah_hk: 25,
                masa_kerja_tahun: 10,
                is_spsi_member: false,
                jabatan_jumlah: 150000,
                masa_kerja_jumlah: 50000
            }
        ], 4, 2026, "AB1");

        const jabatanEntry = entries.find((entry) => entry.adjustment_name === "AUTO TUNJANGAN JABATAN");
        const spsiEntry = entries.find((entry) => entry.adjustment_name === "AUTO SPSI");

        expect(Number(jabatanEntry?.amount ?? -1)).toBe(0);
        expect(Number(spsiEntry?.amount ?? -1)).toBe(0);
    });
});
