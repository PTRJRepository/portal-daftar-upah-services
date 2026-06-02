import { describe, expect, it } from "bun:test";
import { payrollAutoBufferService } from "./payrollAutoBufferService";

describe("payrollAutoBufferService", () => {
    it("forces tunjangan jabatan rate to 0 for exact role karyawan", () => {
        const result = payrollAutoBufferService.calculateAutomaticValues({
            jabatanText: "karyawan",
            roleText: "karyawan",
            hariKerja: 10,
            kehadiran: 10,
            masaKerjaTahun: 3,
            isSpsiMember: false,
            dbJabatanJumlah: 25000,
            dbMasaKerjaJumlah: 0
        });

        expect(result.jabatanRate).toBe(0);
        expect(result.jabatanAmount).toBe(0);
        expect(result.jabatanUsedFallback).toBe(false);
    });

    it("forces tunjangan jabatan rate to 0 for jabatan starting with karyawan", () => {
        const result = payrollAutoBufferService.calculateAutomaticValues({
            jabatanText: "karyawan panen",
            roleText: "karyawan perawatan",
            hariKerja: 12,
            kehadiran: 12,
            masaKerjaTahun: 4,
            isSpsiMember: false,
            dbJabatanJumlah: 42000,
            dbMasaKerjaJumlah: 0
        });

        expect(result.jabatanRate).toBe(0);
        expect(result.jabatanAmount).toBe(0);
        expect(result.jabatanUsedFallback).toBe(false);
    });

    it("forces tunjangan jabatan rate to 0 for jabatan starting with typo karywan", () => {
        const result = payrollAutoBufferService.calculateAutomaticValues({
            jabatanText: "karywan panen",
            roleText: "karywan helper",
            hariKerja: 12,
            kehadiran: 12,
            masaKerjaTahun: 4,
            isSpsiMember: false,
            dbJabatanJumlah: 42000,
            dbMasaKerjaJumlah: 0
        });

        expect(result.jabatanRate).toBe(0);
        expect(result.jabatanAmount).toBe(0);
        expect(result.jabatanUsedFallback).toBe(false);
    });

    it("keeps forced-zero jabatan amount at 0 even if attendance is 0", () => {
        const result = payrollAutoBufferService.calculateAutomaticValues({
            jabatanText: "karyawan",
            roleText: "karyawan",
            hariKerja: 0,
            kehadiran: 0,
            masaKerjaTahun: 3,
            isSpsiMember: false,
            dbJabatanJumlah: 25000,
            dbMasaKerjaJumlah: 0
        });

        expect(result.jabatanRate).toBe(0);
        expect(result.jabatanAmount).toBe(0);
        expect(result.jabatanUsedFallback).toBe(false);
    });

    it("uses 10000 SPSI deduction for SPSI members in IJL division", () => {
        const result = payrollAutoBufferService.calculateAutomaticValues({
            jabatanText: "karyawan",
            roleText: "karyawan",
            hariKerja: 25,
            kehadiran: 25,
            masaKerjaTahun: 3,
            isSpsiMember: true,
            divisionCode: "IJL",
            dbJabatanJumlah: 0,
            dbMasaKerjaJumlah: 0
        });

        expect(result.spsiDeduction).toBe(10000);
    });

    it("keeps db_ptrj display values while comparing against active auto-buffer values", () => {
        const result = payrollAutoBufferService.calculateVerificationValues({
            jabatanText: "karyawan",
            roleText: "karyawan",
            hariKerja: 25,
            kehadiran: 25,
            masaKerjaTahun: 3,
            isSpsiMember: true,
            dbJabatanJumlah: 400,
            dbMasaKerjaJumlah: 0,
            dbPotSpsi: 400,
            useAutoBuffer: false
        });

        expect(result.display.spsiDeduction).toBe(400);
        expect(result.valueSourceCompare.pot_spsi).toEqual({ db_ptrj: 400, active: 4000 });
        expect(result.valueSyncFrame.pot_spsi).toBe("red");
    });

    it("uses hari_kerja only for jabatan calculation - zero hari_kerja with positive kehadiran", () => {
        const result = payrollAutoBufferService.calculateAutomaticValues({
            jabatanText: "mandor",
            roleText: "mandor",
            hariKerja: 0,
            kehadiran: 22,
            masaKerjaTahun: 5,
            isSpsiMember: false,
            dbJabatanJumlah: 50000,
            dbMasaKerjaJumlah: 0
        });

        expect(result.jabatanAmount).toBe(0);
        expect(result.jabatanUsedFallback).toBe(false);
    });

    it("uses hari_kerja only for jabatan calculation - positive hari_kerja ignores kehadiran", () => {
        const result = payrollAutoBufferService.calculateAutomaticValues({
            jabatanText: "mandor",
            roleText: "mandor",
            hariKerja: 20,
            kehadiran: 25,
            masaKerjaTahun: 5,
            isSpsiMember: false,
            dbJabatanJumlah: 0,
            dbMasaKerjaJumlah: 0
        });

        expect(result.jabatanAmount).toBe(70000);
        expect(result.jabatanRate).toBe(3500);
        expect(result.jabatanUsedFallback).toBe(false);
    });

    it("uses hari_kerja only for jabatan calculation - null hari_kerja treated as zero", () => {
        const result = payrollAutoBufferService.calculateAutomaticValues({
            jabatanText: "mandor",
            roleText: "mandor",
            hariKerja: null,
            kehadiran: 22,
            masaKerjaTahun: 5,
            isSpsiMember: false,
            dbJabatanJumlah: 50000,
            dbMasaKerjaJumlah: 0
        });

        expect(result.jabatanAmount).toBe(0);
        expect(result.jabatanUsedFallback).toBe(false);
    });
});
