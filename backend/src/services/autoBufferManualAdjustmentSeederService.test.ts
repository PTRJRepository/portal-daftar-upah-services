import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
    AutoBufferManualAdjustmentSeederService,
    buildAutoBufferSeedEntries
} from "./autoBufferManualAdjustmentSeederService";
import { dataExtractorService } from "./dataExtractorService";
import { Database } from "../db/client";

type SqlCall = {
    sql: string;
    params: any[];
};

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
        expect(spsiEntry?.remarks).toBe("AUTO SPSI | potongan spsi | 4000 | sync:MISS | match:MISMATCH");

        const masaKerjaEntry = entries.find((entry) => entry.adjustment_name === "AUTO MASA KERJA");
        expect(masaKerjaEntry?.remarks).toContain(`AUTO MASA KERJA | masa kerja | ${Number(masaKerjaEntry?.amount || 0)}`);
        expect(masaKerjaEntry?.remarks).toContain("| sync:");
        expect(masaKerjaEntry?.remarks).toContain("| match:");

        const jabatanEntry = entries.find((entry) => entry.adjustment_name === "AUTO TUNJANGAN JABATAN");
        expect(jabatanEntry?.remarks).toContain(`AUTO TUNJANGAN JABATAN | tunjangan jabatan | ${Number(jabatanEntry?.amount || 0)}`);
        expect(jabatanEntry?.remarks).toContain("| sync:");
        expect(jabatanEntry?.remarks).toContain("| match:");
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

    describe("seedPeriod", () => {
        let originalExtractor: typeof dataExtractorService.extractPayrollData;
        let originalGetExtendedInstance: typeof Database.getExtendedInstance;

        beforeEach(() => {
            originalExtractor = dataExtractorService.extractPayrollData;
            originalGetExtendedInstance = Database.getExtendedInstance;
        });

        afterEach(() => {
            (dataExtractorService as any).extractPayrollData = originalExtractor;
            (Database as any).getExtendedInstance = originalGetExtendedInstance;
        });

        it("always replaces scoped AUTO_BUFFER even when replace_existing is false", async () => {
            const queryOneCalls: SqlCall[] = [];
            const queryCalls: SqlCall[] = [];

            const mockDb = {
                queryOne: async (sql: string, params?: any[]) => {
                    queryOneCalls.push({ sql, params: params || [] });
                    if (sql.includes("COUNT(1) as count")) {
                        return { count: 2 };
                    }
                    return null;
                },
                query: async (sql: string, params?: any[]) => {
                    queryCalls.push({ sql, params: params || [] });
                    return [];
                }
            };

            (Database as any).getExtendedInstance = () => mockDb;
            (dataExtractorService as any).extractPayrollData = async () => ({
                data_rows: [{
                    emp_code: "A0001",
                    gang_code: "AB1",
                    jabatan_estate: "Mandor 1",
                    hari_kerja: 24,
                    jumlah_hk: 24,
                    masa_kerja_tahun: 5,
                    is_spsi_member: true,
                    jabatan_jumlah: 0,
                    masa_kerja_jumlah: 0
                }]
            });

            const service = AutoBufferManualAdjustmentSeederService.getInstance();
            const result = await service.seedPeriod({
                period_month: 4,
                period_year: 2026,
                division_code: "ab1",
                gang_code: "ALL",
                replace_existing: false,
                created_by: "tester"
            });

            expect(result.replace_existing).toBe(true);
            expect(result.deleted_existing).toBe(2);
            expect(result.inserted).toBe(3);
            expect(result.updated).toBe(0);

            expect(queryOneCalls.length).toBe(1);

            const deleteCall = queryCalls.find((call) => call.sql.includes("DELETE FROM dbo.payroll_manual_adjustments"));
            expect(deleteCall).toBeDefined();
            expect(deleteCall?.params).toEqual([4, 2026, "AB1"]);
            expect(deleteCall?.sql).toContain("adjustment_type = 'AUTO_BUFFER'");

            const insertCalls = queryCalls.filter((call) => call.sql.includes("INSERT INTO dbo.payroll_manual_adjustments"));
            expect(insertCalls.length).toBe(3);
        });

        it("applies gang-specific replace scope and never updates in-place", async () => {
            const queryOneCalls: SqlCall[] = [];
            const queryCalls: SqlCall[] = [];

            const mockDb = {
                queryOne: async (sql: string, params?: any[]) => {
                    queryOneCalls.push({ sql, params: params || [] });
                    if (sql.includes("COUNT(1) as count")) {
                        return { count: 5 };
                    }
                    return null;
                },
                query: async (sql: string, params?: any[]) => {
                    queryCalls.push({ sql, params: params || [] });
                    return [];
                }
            };

            (Database as any).getExtendedInstance = () => mockDb;
            (dataExtractorService as any).extractPayrollData = async () => ({
                data_rows: [{
                    emp_code: "A0002",
                    gang_code: "G1H",
                    jabatan_estate: "Mandor 1",
                    hari_kerja: 24,
                    jumlah_hk: 24,
                    masa_kerja_tahun: 5,
                    is_spsi_member: true,
                    jabatan_jumlah: 0,
                    masa_kerja_jumlah: 0
                }]
            });

            const service = AutoBufferManualAdjustmentSeederService.getInstance();
            const result = await service.seedPeriod({
                period_month: 4,
                period_year: 2026,
                division_code: "AB1",
                gang_code: "G1H",
                created_by: "tester"
            });

            expect(result.deleted_existing).toBe(5);
            expect(result.inserted).toBe(3);
            expect(result.updated).toBe(0);
            expect(result.replace_existing).toBe(true);
            expect(queryOneCalls.length).toBe(1);

            const deleteCall = queryCalls.find((call) => call.sql.includes("DELETE FROM dbo.payroll_manual_adjustments"));
            expect(deleteCall).toBeDefined();
            expect(deleteCall?.sql).toContain("AND gang_code = ?");
            expect(deleteCall?.params).toEqual([4, 2026, "AB1", "G1H"]);

            const updateCalls = queryCalls.filter((call) => call.sql.includes("UPDATE dbo.payroll_manual_adjustments"));
            expect(updateCalls.length).toBe(0);
        });
    });
});
