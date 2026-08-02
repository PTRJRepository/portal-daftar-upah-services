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

    it("zeroes jabatan when hariKerja=0 even if kehadiran>0 (sick/leave rule: jabatan = hadir HK only)", () => {
        // B0088 ZUWIRDA — all 30 days leave in June, hari_kerja=0, but total attendance hk=30.
        // Business rule: tunjangan jabatan multiplies hadir (attendance) HK only; leave is not counted.
        const result = payrollAutoBufferService.calculateAutomaticValues({
            jabatanText: "kerani kantor",
            roleText: "",
            hariKerja: 0,
            kehadiran: 30,
            masaKerjaTahun: 19,
            isSpsiMember: false,
            dbJabatanJumlah: 0,
            dbMasaKerjaJumlah: 57500,
            divisionCode: "P1B"
        });

        expect(result.jabatanAmount).toBe(0);
        expect(result.jabatanRate).toBe(0);
        expect(result.jabatanUsedFallback).toBe(true);
    });

    it("forces 10000 SPSI deduction for SPSI members in IJL division", () => {
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
});
