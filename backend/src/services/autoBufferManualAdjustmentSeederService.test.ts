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
    it("builds 4 AUTO_BUFFER entries per employee including POTONGAN PPH from pph21_ter", () => {
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
                masa_kerja_jumlah: 0,
                pot_spsi: 0,
                pot_pph21: 28655,
                pph21_ter: 93435
            }
        ], 4, 2026, "AB1");

        expect(entries.length).toBe(4);
        expect(entries.every((entry) => entry.adjustment_type === "AUTO_BUFFER")).toBe(true);
        expect(entries.map((entry) => entry.adjustment_name).sort()).toEqual([
            "MASA KERJA",
            "POTONGAN PPH",
            "SPSI",
            "TUNJANGAN JABATAN"
        ]);

        const pphEntry = entries.find((entry) => entry.adjustment_name === "POTONGAN PPH");
        expect(Number(pphEntry?.amount || 0)).toBe(93435);
        expect(pphEntry?.remarks).toBe(
            "POTONGAN PPH | (DE) POTONGAN PPH21 | 93435 | sync:MISS | match:MISMATCH"
        );
        expect(JSON.parse(pphEntry?.metadata_json || "{}")).toMatchObject({
            input_type: "auto_buffer",
            adjustment_type: "AUTO_BUFFER",
            adjustment_name: "POTONGAN PPH",
            amount: 93435,
            total_amount: 93435
        });

        const spsiEntry = entries.find((entry) => entry.adjustment_name === "SPSI");
        expect(Number(spsiEntry?.amount || 0)).toBe(4000);
        expect(spsiEntry?.remarks).toBe("SPSI | potongan spsi | 4000 | sync:MISS | match:MISMATCH");

        const masaKerjaEntry = entries.find((entry) => entry.adjustment_name === "MASA KERJA");
        expect(masaKerjaEntry?.remarks).toContain(`MASA KERJA | masa kerja | ${Number(masaKerjaEntry?.amount || 0)}`);
        expect(masaKerjaEntry?.remarks).toContain("| sync:");
        expect(masaKerjaEntry?.remarks).toContain("| match:");

        const jabatanEntry = entries.find((entry) => entry.adjustment_name === "TUNJANGAN JABATAN");
        expect(jabatanEntry?.remarks).toContain(`TUNJANGAN JABATAN | tunjangan jabatan | ${Number(jabatanEntry?.amount || 0)}`);
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

        const jabatanEntry = entries.find((entry) => entry.adjustment_name === "TUNJANGAN JABATAN");
        const spsiEntry = entries.find((entry) => entry.adjustment_name === "SPSI");

        expect(Number(jabatanEntry?.amount ?? -1)).toBe(0);
        expect(Number(spsiEntry?.amount ?? -1)).toBe(0);
    });

    it("uses 10000 SPSI for IJL auto-buffer seed entries", () => {
        const entries = buildAutoBufferSeedEntries([
            {
                emp_code: "L0001",
                gang_code: "L1H",
                jabatan_estate: "Karyawan Panen",
                hari_kerja: 25,
                jumlah_hk: 25,
                masa_kerja_tahun: 3,
                is_spsi_member: true,
                jabatan_jumlah: 0,
                masa_kerja_jumlah: 0,
                pot_spsi: 0,
                pot_pph21: 0,
                pph21_ter: 0
            }
        ], 5, 2026, "IJL");

        const spsiEntry = entries.find((entry) => entry.adjustment_name === "SPSI");
        expect(spsiEntry?.division_code).toBe("IJL");
        expect(Number(spsiEntry?.amount || 0)).toBe(10000);
        expect(spsiEntry?.remarks).toBe("SPSI | potongan spsi | 10000 | sync:MISS | match:MISMATCH");
    });

    it("uses edit-mode SPSI checkbox for SPSI amount instead of db pot_spsi", () => {
        const entries = buildAutoBufferSeedEntries([
            {
                emp_code: "A0003",
                gang_code: "AB1",
                jabatan_estate: "Karyawan Panen",
                hari_kerja: 25,
                jumlah_hk: 25,
                masa_kerja_tahun: 10,
                is_spsi_member: false,
                pot_spsi: 4000,
                jabatan_jumlah: 0,
                masa_kerja_jumlah: 0
            }
        ], 4, 2026, "AB1");

        const spsiEntry = entries.find((entry) => entry.adjustment_name === "SPSI");

        expect(Number(spsiEntry?.amount ?? -1)).toBe(0);
    });

    it("keeps PTRJ emp_code and stores stable KTP NIK separately when extractor has both identifiers", () => {
        const entries = buildAutoBufferSeedEntries([
            {
                emp_code: "F0520",
                nik: "1902050504860001",
                nama: "BUDI TEST",
                gang_code: "F1H",
                jabatan_estate: "Karyawan Panen",
                hari_kerja: 24,
                jumlah_hk: 24,
                masa_kerja_tahun: 8,
                is_spsi_member: true,
                jabatan_jumlah: 0,
                masa_kerja_jumlah: 60000
            }
        ], 4, 2026, "F1");

        expect(entries.length).toBe(4);
        expect(entries.every((entry) => entry.emp_code === "F0520")).toBe(true);
        expect(entries.every((entry) => entry.nik === "1902050504860001")).toBe(true);
        expect(entries.every((entry) => entry.emp_name === "BUDI TEST")).toBe(true);
        expect(entries.find((entry) => entry.adjustment_name === "MASA KERJA")?.amount).toBeGreaterThan(0);

        const metadata = JSON.parse(entries[0].metadata_json);
        expect(metadata).toMatchObject({
            input_type: "auto_buffer",
            emp_code: "F0520",
            nik: "1902050504860001",
            emp_name: "BUDI TEST",
            gang_code: "F1H",
            division_code: "F1"
        });
    });

    it("does not seed rows when extractor only has numeric KTP NIK as emp_code", () => {
        const entries = buildAutoBufferSeedEntries([
            {
                emp_code: "1902050504860001",
                nik: "1902050504860001",
                nama: "BUDI TEST",
                gang_code: "F1H",
                jabatan_estate: "Karyawan Panen",
                hari_kerja: 24,
                jumlah_hk: 24,
                masa_kerja_tahun: 8,
                is_spsi_member: true,
                jabatan_jumlah: 0,
                masa_kerja_jumlah: 60000
            }
        ], 4, 2026, "F1");

        expect(entries).toEqual([]);
    });

    it("normalizes stored division_code to the 3-character payroll format", () => {
        const entries = buildAutoBufferSeedEntries([
            {
                emp_code: "A0005",
                gang_code: "A1H",
                jabatan_estate: "Karyawan Panen",
                hari_kerja: 25,
                jumlah_hk: 25,
                masa_kerja_tahun: 1,
                is_spsi_member: true,
                jabatan_jumlah: 0,
                masa_kerja_jumlah: 0
            }
        ], 4, 2026, "PG1A");

        expect(entries.length).toBe(4);
        expect(entries.every((entry) => entry.division_code === "P1A")).toBe(true);
    });

    describe("seedPeriod", () => {
        let originalExtractor: typeof dataExtractorService.extractPayrollData;
        let originalGetExtendedInstance: typeof Database.getExtendedInstance;
        let originalGetInstance: typeof Database.getInstance;

        beforeEach(() => {
            originalExtractor = dataExtractorService.extractPayrollData;
            originalGetExtendedInstance = Database.getExtendedInstance;
            originalGetInstance = Database.getInstance;
        });

        afterEach(() => {
            (dataExtractorService as any).extractPayrollData = originalExtractor;
            (Database as any).getExtendedInstance = originalGetExtendedInstance;
            (Database as any).getInstance = originalGetInstance;
        });

        it("preserves user-edited AUTO_BUFFER rows when reseeding the same scope", async () => {
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
                    if (sql.includes("SELECT emp_code, nik, adjustment_name")) {
                        return [{
                            emp_code: "A0001",
                            nik: null,
                            adjustment_name: "SPSI",
                            remarks: "SPSI | MANUAL EDIT | 0 | sync:MANUAL | match:MANUAL"
                        }];
                    }
                    return [];
                }
            };

            (Database as any).getExtendedInstance = () => mockDb;
            const extractorCalls: any[][] = [];
            (dataExtractorService as any).extractPayrollData = async (...args: any[]) => {
                extractorCalls.push(args);
                return {
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
                };
            };

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
            expect(result.preserved_manual).toBe(1);
            expect(result.skipped_manual_conflicts).toBe(1);
            expect(extractorCalls[0]?.[12]).toBe("non_db_ptrj");

            expect(queryOneCalls.length).toBe(1);

            const deleteCall = queryCalls.find((call) => call.sql.includes("DELETE FROM dbo.payroll_manual_adjustments"));
            expect(deleteCall).toBeDefined();
            expect(deleteCall?.params).toEqual([4, 2026, "AB1"]);
            expect(deleteCall?.sql).toContain("adjustment_type = 'AUTO_BUFFER'");
            expect(deleteCall?.sql).toContain("SYNC:MANUAL");
            expect(deleteCall?.sql).toContain("MATCH:MANUAL");
            expect(deleteCall?.sql).toContain("POTONGAN PPH");
            expect(deleteCall?.sql).toContain("AUTO POTONGAN PPH");

            const insertCalls = queryCalls.filter((call) => call.sql.includes("INSERT INTO dbo.payroll_manual_adjustments"));
            expect(insertCalls.length).toBe(3);
            expect(insertCalls.some((call) => call.params?.[8] === "SPSI")).toBe(false);
            expect(insertCalls.some((call) => call.params?.[8] === "POTONGAN PPH")).toBe(true);
        });

        it("uses profile override keyed by NIK before calculating SPSI amount", async () => {
            const queryCalls: SqlCall[] = [];
            const mockExtendedDb = {
                queryOne: async (sql: string) => sql.includes("COUNT(1) as count") ? { count: 0 } : null,
                query: async (sql: string, params?: any[]) => {
                    queryCalls.push({ sql, params: params || [] });
                    if (sql.includes("employee_profile_override_history")) {
                        return [{ emp_code: "1902016806780001", nik: "1902016806780001", is_spsi_member: true, update_index: 1 }];
                    }
                    return [];
                }
            };

            (Database as any).getExtendedInstance = () => mockExtendedDb;
            (Database as any).getInstance = () => ({ query: async () => [] });
            (dataExtractorService as any).extractPayrollData = async () => ({
                data_rows: [{
                    emp_code: "A0004",
                    nik: "1902016806780001",
                    nama: "YUNIARTI ( HATIMAH )",
                    gang_code: "A2M",
                    jabatan_estate: "Karyawan Panen",
                    hari_kerja: 24,
                    jumlah_hk: 24,
                    masa_kerja_tahun: 12,
                    is_spsi_member: false,
                    pot_spsi: 4000,
                    jabatan_jumlah: 0,
                    masa_kerja_jumlah: 33000
                }]
            });

            const service = AutoBufferManualAdjustmentSeederService.getInstance();
            await service.seedPeriod({
                period_month: 4,
                period_year: 2026,
                division_code: "P1A",
                created_by: "tester"
            });

            const spsiInsert = queryCalls.find((call) =>
                call.sql.includes("INSERT INTO dbo.payroll_manual_adjustments") &&
                call.params?.[8] === "SPSI"
            );
            expect(spsiInsert?.params?.[9]).toBe(4000);
        });

        it("uses profile override keyed by letter EmpCode before calculating PTRJ-keyed SPSI amount", async () => {
            const queryCalls: SqlCall[] = [];
            const mockExtendedDb = {
                queryOne: async (sql: string) => sql.includes("COUNT(1) as count") ? { count: 0 } : null,
                query: async (sql: string, params?: any[]) => {
                    queryCalls.push({ sql, params: params || [] });
                    if (sql.includes("employee_profile_override_history")) {
                        return [{ emp_code: "A0004", nik: "1902016806780001", is_spsi_member: true, update_index: 2 }];
                    }
                    return [];
                }
            };

            (Database as any).getExtendedInstance = () => mockExtendedDb;
            (Database as any).getInstance = () => ({ query: async () => [] });
            (dataExtractorService as any).extractPayrollData = async () => ({
                data_rows: [{
                    emp_code: "A0004",
                    nik: "1902016806780001",
                    nama: "YUNIARTI ( HATIMAH )",
                    gang_code: "A2M",
                    jabatan_estate: "Karyawan Panen",
                    hari_kerja: 24,
                    jumlah_hk: 24,
                    masa_kerja_tahun: 12,
                    is_spsi_member: false,
                    pot_spsi: 0,
                    jabatan_jumlah: 0,
                    masa_kerja_jumlah: 33000
                }]
            });

            const service = AutoBufferManualAdjustmentSeederService.getInstance();
            await service.seedPeriod({
                period_month: 4,
                period_year: 2026,
                division_code: "P1A",
                created_by: "tester"
            });

            const spsiInsert = queryCalls.find((call) =>
                call.sql.includes("INSERT INTO dbo.payroll_manual_adjustments") &&
                call.params?.[8] === "SPSI"
            );
            expect(spsiInsert?.params?.[2]).toBe("A0004");
            expect(spsiInsert?.params?.[3]).toBe("1902016806780001");
            expect(spsiInsert?.params?.[9]).toBe(4000);

            const metadata = JSON.parse(spsiInsert?.params?.[11]);
            expect(metadata).toMatchObject({
                input_type: "auto_buffer",
                emp_code: "A0004",
                nik: "1902016806780001",
                adjustment_name: "SPSI"
            });
        });

        it("refreshes seeded remarks against db_ptrj PR_ADTRANS", async () => {
            const extendedQueryCalls: SqlCall[] = [];

            const mockExtendedDb = {
                queryOne: async (sql: string) => sql.includes("COUNT(1) as count") ? { count: 0 } : null,
                query: async (sql: string, params?: any[]) => {
                    extendedQueryCalls.push({ sql, params: params || [] });
                    if (sql.includes("SELECT id, emp_code, adjustment_name, amount, remarks")) {
                        return [{
                            id: 20,
                            emp_code: "F0520",
                            nik: "1902050504860001",
                            adjustment_name: "MASA KERJA",
                            amount: 60000,
                            remarks: "MASA KERJA | masa kerja | 60000 | sync:MISS | match:MISMATCH"
                        }];
                    }
                    return [];
                }
            };

            const mockMainDb = {
                query: async (sql: string) => {
                    if (sql.includes("PR_ADTRANS")) {
                        return [{
                            emp_code: "F0520",
                            nik: "1902050504860001",
                            adjustment_name: "MASA KERJA",
                            total: 60000
                        }];
                    }
                    return [];
                }
            };

            (Database as any).getExtendedInstance = () => mockExtendedDb;
            (Database as any).getInstance = () => mockMainDb;
            (dataExtractorService as any).extractPayrollData = async () => ({
                data_rows: [{
                    emp_code: "F0520",
                    nik: "1902050504860001",
                    nama: "BUDI TEST",
                    gang_code: "P1A",
                    jabatan_estate: "Karyawan Panen",
                    hari_kerja: 24,
                    jumlah_hk: 24,
                    masa_kerja_tahun: 8,
                    is_spsi_member: false,
                    jabatan_jumlah: 0,
                    masa_kerja_jumlah: 60000
                }]
            });

            const service = AutoBufferManualAdjustmentSeederService.getInstance();
            const result = await service.seedPeriod({
                period_month: 4,
                period_year: 2026,
                division_code: "P1A",
                created_by: "tester"
            });

            expect(result.validation).toEqual({ processed: 1, updated: 1, matches: 1, misses: 0 });
            expect(extendedQueryCalls.some((call) => call.sql.includes("UPDATE dbo.payroll_manual_adjustments"))).toBe(true);
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
            expect(result.inserted).toBe(4);
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

        it("validates PTRJ-keyed auto buffer rows against db_ptrj PR_ADTRANS EmpCode values", async () => {
            const extendedQueryCalls: SqlCall[] = [];

            const mockExtendedDb = {
                query: async (sql: string, params?: any[]) => {
                    extendedQueryCalls.push({ sql, params: params || [] });
                    if (sql.includes("SELECT id, emp_code, adjustment_name, amount, remarks")) {
                        return [{
                            id: 10,
                            emp_code: "F0520",
                            nik: "1902050504860001",
                            adjustment_name: "MASA KERJA",
                            amount: 60000,
                            remarks: "MASA KERJA | masa kerja | 60000 | sync:MISS | match:MISMATCH"
                        }];
                    }
                    return [];
                }
            };

            const mockMainDb = {
                query: async (sql: string, params?: any[]) => {
                    if (sql.includes("PR_ADTRANS")) {
                        return [{
                            emp_code: "F0520",
                            nik: "1902050504860001",
                            adjustment_name: "MASA KERJA",
                            total: 60000
                        }];
                    }
                    return [];
                }
            };

            (Database as any).getExtendedInstance = () => mockExtendedDb;
            (Database as any).getInstance = () => mockMainDb;

            const service = AutoBufferManualAdjustmentSeederService.getInstance();
            const result = await service.validatePeriod({
                period_month: 4,
                period_year: 2026,
                division_code: "P1A",
                created_by: "tester"
            });

            expect(result.processed).toBe(1);
            expect(result.matches).toBe(1);
            expect(result.misses).toBe(0);

            const updateCall = extendedQueryCalls.find((call) => call.sql.includes("UPDATE dbo.payroll_manual_adjustments"));
            expect(updateCall).toBeDefined();
            expect(updateCall?.params[0]).toBe("MASA KERJA | masa kerja | 60000 | sync:SYNC | match:MATCH");
        });

        it("keeps POTONGAN PPH MISS during validation even when it equals pph21_ter", async () => {
            const extendedQueryCalls: SqlCall[] = [];
            const mainQueryCalls: SqlCall[] = [];

            const mockExtendedDb = {
                query: async (sql: string, params?: any[]) => {
                    extendedQueryCalls.push({ sql, params: params || [] });
                    if (sql.includes("SELECT id, emp_code, adjustment_name, amount, remarks")) {
                        return [{
                            id: 40,
                            emp_code: "A0001",
                            nik: "1902050504860001",
                            adjustment_name: "POTONGAN PPH",
                            amount: 93435,
                            remarks: "POTONGAN PPH | (DE) POTONGAN PPH21 | 93435 | sync:MISS | match:MISMATCH"
                        }];
                    }
                    return [];
                }
            };

            const mockMainDb = {
                query: async (sql: string, params?: any[]) => {
                    mainQueryCalls.push({ sql, params: params || [] });
                    if (sql.includes("DEPH21") && sql.includes("POTONGAN PPH")) {
                        return [{
                            emp_code: "A0001",
                            nik: "1902050504860001",
                            adjustment_name: "POTONGAN PPH",
                            total: -93435
                        }];
                    }
                    return [];
                }
            };

            (Database as any).getExtendedInstance = () => mockExtendedDb;
            (Database as any).getInstance = () => mockMainDb;

            const service = AutoBufferManualAdjustmentSeederService.getInstance();
            const result = await service.validatePeriod({
                period_month: 4,
                period_year: 2026,
                division_code: "AB1",
                created_by: "tester"
            });

            expect(result.processed).toBe(1);
            expect(result.matches).toBe(0);
            expect(result.misses).toBe(1);
            expect(mainQueryCalls[0]?.sql).toContain("DEPH21");
            expect(mainQueryCalls[0]?.sql).toContain("POTONGAN PPH");

            const updateCall = extendedQueryCalls.find((call) => call.sql.includes("UPDATE dbo.payroll_manual_adjustments"));
            expect(updateCall).toBeUndefined();
        });

        it("keeps POTONGAN PPH MISS when db_ptrj PPh21 differs from seeded pph21_ter", async () => {
            const extendedQueryCalls: SqlCall[] = [];

            const mockExtendedDb = {
                query: async (sql: string, params?: any[]) => {
                    extendedQueryCalls.push({ sql, params: params || [] });
                    if (sql.includes("SELECT id, emp_code, adjustment_name, amount, remarks")) {
                        return [{
                            id: 41,
                            emp_code: "A0002",
                            nik: "1902050504860002",
                            adjustment_name: "POTONGAN PPH",
                            amount: 93435,
                            remarks: "POTONGAN PPH | (DE) POTONGAN PPH21 | 93435 | sync:SYNC | match:MATCH"
                        }];
                    }
                    return [];
                }
            };

            const mockMainDb = {
                query: async (sql: string) => {
                    if (sql.includes("DEPH21") && sql.includes("POTONGAN PPH")) {
                        return [{
                            emp_code: "A0002",
                            nik: "1902050504860002",
                            adjustment_name: "POTONGAN PPH",
                            total: -28655
                        }];
                    }
                    return [];
                }
            };

            (Database as any).getExtendedInstance = () => mockExtendedDb;
            (Database as any).getInstance = () => mockMainDb;

            const service = AutoBufferManualAdjustmentSeederService.getInstance();
            const result = await service.validatePeriod({
                period_month: 4,
                period_year: 2026,
                division_code: "AB1",
                created_by: "tester"
            });

            expect(result.processed).toBe(1);
            expect(result.matches).toBe(0);
            expect(result.misses).toBe(1);

            const updateCall = extendedQueryCalls.find((call) => call.sql.includes("UPDATE dbo.payroll_manual_adjustments"));
            expect(updateCall?.params[0]).toBe("POTONGAN PPH | (DE) POTONGAN PPH21 | 93435 | sync:MISS | match:MISMATCH");
        });

        it("does not validate or rewrite user-edited AUTO_BUFFER remarks", async () => {
            const extendedQueryCalls: SqlCall[] = [];

            const mockExtendedDb = {
                query: async (sql: string, params?: any[]) => {
                    extendedQueryCalls.push({ sql, params: params || [] });
                    if (sql.includes("SELECT id, emp_code, adjustment_name, amount, remarks")) {
                        return [];
                    }
                    return [];
                }
            };

            const mockMainDb = {
                query: async (sql: string) => {
                    if (sql.includes("PR_ADTRANS")) {
                        return [{
                            emp_code: "F0520",
                            nik: "1902050504860001",
                            adjustment_name: "MASA KERJA",
                            total: 60000
                        }];
                    }
                    return [];
                }
            };

            (Database as any).getExtendedInstance = () => mockExtendedDb;
            (Database as any).getInstance = () => mockMainDb;

            const service = AutoBufferManualAdjustmentSeederService.getInstance();
            const result = await service.validatePeriod({
                period_month: 4,
                period_year: 2026,
                division_code: "P1A",
                created_by: "tester"
            });

            expect(result).toEqual({ processed: 0, updated: 0, matches: 0, misses: 0 });

            const fetchCall = extendedQueryCalls.find((call) => call.sql.includes("SELECT id, emp_code, adjustment_name, amount, remarks"));
            expect(fetchCall?.sql).toContain("SYNC:MANUAL");
            expect(fetchCall?.sql).toContain("MATCH:MANUAL");

            const updateCall = extendedQueryCalls.find((call) => call.sql.includes("UPDATE dbo.payroll_manual_adjustments"));
            expect(updateCall).toBeUndefined();
        });

        it("keeps MISS when PTRJ-keyed auto buffer amount differs from db_ptrj PR_ADTRANS", async () => {
            const extendedQueryCalls: SqlCall[] = [];

            const mockExtendedDb = {
                query: async (sql: string, params?: any[]) => {
                    extendedQueryCalls.push({ sql, params: params || [] });
                    if (sql.includes("SELECT id, emp_code, adjustment_name, amount, remarks")) {
                        return [{
                            id: 11,
                            emp_code: "F0520",
                            nik: "1902050504860001",
                            adjustment_name: "MASA KERJA",
                            amount: 60000,
                            remarks: "MASA KERJA | masa kerja | 60000 | sync:SYNC | match:MATCH"
                        }];
                    }
                    return [];
                }
            };

            const mockMainDb = {
                query: async (sql: string) => {
                    if (sql.includes("PR_ADTRANS")) {
                        return [{
                            emp_code: "F0520",
                            nik: "1902050504860001",
                            adjustment_name: "MASA KERJA",
                            total: 70000
                        }];
                    }
                    return [];
                }
            };

            (Database as any).getExtendedInstance = () => mockExtendedDb;
            (Database as any).getInstance = () => mockMainDb;

            const service = AutoBufferManualAdjustmentSeederService.getInstance();
            const result = await service.validatePeriod({
                period_month: 4,
                period_year: 2026,
                division_code: "P1A",
                created_by: "tester"
            });

            expect(result.processed).toBe(1);
            expect(result.matches).toBe(0);
            expect(result.misses).toBe(1);

            const updateCall = extendedQueryCalls.find((call) => call.sql.includes("UPDATE dbo.payroll_manual_adjustments"));
            expect(updateCall).toBeDefined();
            expect(updateCall?.params[0]).toBe("MASA KERJA | masa kerja | 60000 | sync:MISS | match:MISMATCH");
        });
    });
});
