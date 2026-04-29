import { afterEach, describe, expect, it, mock } from "bun:test";
import { Database } from "../db/client";
import { taskCodeOptionService } from "./taskCodeOptionService";
import { manualAdjustmentPresetService } from "./manualAdjustmentPresetService";
import {
    buildAdtransDuplicateReport,
    buildManualAdjustmentRemarks,
    manualAdjustmentRequiresAdCode,
    manualAdjustmentService
} from "./manualAdjustmentService";

type QueryCall = {
    sql: string;
    params: any[];
};

describe("manual adjustment ADCode rules", () => {
    it("requires ADCode for every manual adjustment type except auto buffer", () => {
        expect(manualAdjustmentRequiresAdCode("PREMI")).toBe(true);
        expect(manualAdjustmentRequiresAdCode("POTONGAN_KOTOR")).toBe(true);
        expect(manualAdjustmentRequiresAdCode("POTONGAN_BERSIH")).toBe(true);
        expect(manualAdjustmentRequiresAdCode("PENDAPATAN_LAINNYA")).toBe(true);
        expect(manualAdjustmentRequiresAdCode("AUTO_BUFFER")).toBe(false);
    });

    it("builds ADCode remarks from structured fields", () => {
        expect(buildManualAdjustmentRemarks({
            period_month: 4,
            period_year: 2026,
            emp_code: "A0001",
            gang_code: "G1H",
            adjustment_type: "PREMI",
            adjustment_name: "PREMI MANUAL",
            amount: 1000,
            ad_code: "AL001",
            task_desc: "(AL) PANEN"
        })).toBe("AD CODE: AL001 - (AL) PANEN");
    });

    it("preserves existing remarks after the ADCode prefix", () => {
        expect(buildManualAdjustmentRemarks({
            period_month: 4,
            period_year: 2026,
            emp_code: "A0001",
            gang_code: "G1H",
            adjustment_type: "POTONGAN_KOTOR",
            adjustment_name: "KOREKSI MANUAL",
            amount: -1000,
            ad_code: "DE001",
            task_desc: "(DE) KOREKSI",
            remarks: "catatan user"
        })).toBe("AD CODE: DE001 - (DE) KOREKSI; catatan user");
    });

    it("does not duplicate an existing ADCode remark", () => {
        expect(buildManualAdjustmentRemarks({
            period_month: 4,
            period_year: 2026,
            emp_code: "A0001",
            gang_code: "G1H",
            adjustment_type: "POTONGAN_BERSIH",
            adjustment_name: "POTONGAN MANUAL",
            amount: -1000,
            ad_code: "DE001",
            task_desc: "(DE) POTONGAN",
            remarks: "AD CODE: DE001 - (DE) POTONGAN"
        })).toBe("AD CODE: DE001 - (DE) POTONGAN");
    });

    it("preserves pipe-formatted sync remarks without adding ADCode prefix", () => {
        expect(buildManualAdjustmentRemarks({
            period_month: 4,
            period_year: 2026,
            emp_code: "A0001",
            gang_code: "G1H",
            adjustment_type: "POTONGAN_KOTOR",
            adjustment_name: "KOREKSI DENDA",
            amount: 0,
            ad_code: "DE0004",
            task_desc: "(DE) POTONGAN PREMI",
            remarks: "KOREKSI DENDA | DE0004 - (DE) POTONGAN PREMI | 0 | sync:MISS | match:MISMATCH"
        })).toBe("KOREKSI DENDA | DE0004 - (DE) POTONGAN PREMI | 0 | sync:MISS | match:MISMATCH");
    });

    it("rejects new manual column initialization without ADCode before querying", async () => {
        const originalGetInstance = Database.getInstance;
        let queryCalled = false;
        const mockDb = {
            queryOne: async () => {
                queryCalled = true;
                return null;
            },
            query: async () => {
                queryCalled = true;
                return [];
            }
        };

        (Database as any).getInstance = () => mockDb;

        try {
            await expect(manualAdjustmentService.saveAdjustment({
                period_month: 4,
                period_year: 2026,
                emp_code: "A0001",
                gang_code: "G1H",
                adjustment_type: "PREMI",
                adjustment_name: "PREMI MANUAL",
                amount: 0,
                remarks: "INIT_COLUMN - Kolom ditambahkan tanpa nilai"
            })).rejects.toThrow("ADCode wajib diisi");
            expect(queryCalled).toBe(false);
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });

    it("allows legacy inline manual edits without ADCode", async () => {
        const originalGetInstance = Database.getInstance;
        const calls: QueryCall[] = [];
        const mockDb = {
            queryOne: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                return null;
            },
            query: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                return [{ id: 88 }];
            }
        };

        (Database as any).getInstance = () => mockDb;

        try {
            const id = await manualAdjustmentService.saveAdjustment({
                period_month: 4,
                period_year: 2026,
                emp_code: "A0001",
                gang_code: "G1H",
                adjustment_type: "PREMI",
                adjustment_name: "PREMI EXISTING",
                amount: 1000,
                remarks: "Edited via UI"
            });

            expect(id).toBe(88);
            expect(calls.some((call) => call.sql.includes("INSERT INTO dbo.payroll_manual_adjustments"))).toBe(true);
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });

    it("allows edit-mode sync manual remarks without ADCode", async () => {
        const originalGetInstance = Database.getInstance;
        const calls: QueryCall[] = [];
        const mockDb = {
            queryOne: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                return null;
            },
            query: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                return [{ id: 90 }];
            }
        };

        (Database as any).getInstance = () => mockDb;

        try {
            const id = await manualAdjustmentService.saveAdjustment({
                period_month: 4,
                period_year: 2026,
                emp_code: "A0001",
                gang_code: "G1H",
                adjustment_type: "PREMI",
                adjustment_name: "PREMI EXISTING",
                amount: 1000,
                remarks: "PREMI EXISTING | MANUAL EDIT | 1000 | sync:MANUAL | match:MANUAL"
            });

            expect(id).toBe(90);
            expect(calls.some((call) => call.sql.includes("INSERT INTO dbo.payroll_manual_adjustments"))).toBe(true);
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });

    it("fills preset ADCode from task mapping for edit-mode saves", async () => {
        const originalGetInstance = Database.getInstance;
        const originalSearchOptions = taskCodeOptionService.searchOptions;
        const originalUpsertPreset = manualAdjustmentPresetService.upsertPreset;
        const upsertPreset = mock(async () => 123);
        const mockDb = {
            queryOne: async () => null,
            query: async () => [{ id: 91 }]
        };

        (Database as any).getInstance = () => mockDb;
        (taskCodeOptionService as any).searchOptions = async () => [{
            ad_code: "AL001",
            task_code: "AL001P2A",
            base_task_code: "AL001",
            task_desc: "(AL) PANEN",
            loc_code: "P2A",
            task_type: null,
            task_grp: null,
            task_nature: null,
            is_deduction: 0,
            adj_ad_code: "AL001",
            doc_desc: "(AL) PANEN"
        }];
        (manualAdjustmentPresetService as any).upsertPreset = upsertPreset;

        try {
            const id = await manualAdjustmentService.saveAdjustment({
                period_month: 4,
                period_year: 2026,
                emp_code: "A0001",
                gang_code: "G1H",
                division_code: "PG2A",
                adjustment_type: "PREMI",
                adjustment_name: "PREMI PANEN",
                amount: 1000,
                remarks: "PREMI PANEN | MANUAL EDIT | 1000 | sync:MANUAL | match:MANUAL"
            });

            expect(id).toBe(91);
            expect(upsertPreset.mock.calls[0][0]).toMatchObject({
                ad_code: "AL001",
                task_code: "AL001P2A",
                base_task_code: "AL001",
                task_desc: "(AL) PANEN"
            });
        } finally {
            (Database as any).getInstance = originalGetInstance;
            (taskCodeOptionService as any).searchOptions = originalSearchOptions;
            (manualAdjustmentPresetService as any).upsertPreset = originalUpsertPreset;
        }
    });

    it("stores emp_name when saving manual adjustment rows", async () => {
        const originalGetInstance = Database.getInstance;
        const calls: QueryCall[] = [];
        const mockDb = {
            queryOne: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                return null;
            },
            query: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                return [{ id: 89 }];
            }
        };

        (Database as any).getInstance = () => mockDb;

        try {
            const id = await manualAdjustmentService.saveAdjustment({
                period_month: 4,
                period_year: 2026,
                emp_code: "1902050504860001",
                gang_code: "P1A",
                division_code: "P1A",
                adjustment_type: "PREMI",
                adjustment_name: "PREMI EXISTING",
                amount: 1000,
                remarks: "Edited via UI",
                emp_name: "BUDI TEST"
            } as any);

            expect(id).toBe(89);
            const insertCall = calls.find((call) => call.sql.includes("INSERT INTO dbo.payroll_manual_adjustments"));
            expect(insertCall?.sql).toContain("emp_name");
            expect(insertCall?.params).toContain("BUDI TEST");
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });

    it("allows auto-buffer adjustment without ADCode", async () => {
        const originalGetInstance = Database.getInstance;
        const calls: QueryCall[] = [];
        const mockDb = {
            queryOne: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                return null;
            },
            query: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                return [{ id: 99 }];
            }
        };

        (Database as any).getInstance = () => mockDb;

        try {
            const id = await manualAdjustmentService.saveAdjustment({
                period_month: 4,
                period_year: 2026,
                emp_code: "A0001",
                gang_code: "G1H",
                adjustment_type: "AUTO_BUFFER",
                adjustment_name: "AUTO SPSI",
                amount: 4000
            });

            expect(id).toBe(99);
            expect(calls.length).toBe(3);
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });
});

describe("manualAdjustmentService duplicate PR_ADTRANS report", () => {
    it("groups duplicate records by employee and requested category", () => {
        const report = buildAdtransDuplicateReport([
            { id: 10, doc_id: "DOC-OLD", doc_date: "2026-04-01", doc_desc: "POTONGAN SPSI", emp_code: "A0001", emp_name: "BUDI", amount: 4000 },
            { id: 12, doc_id: "DOC-NEW", doc_date: "2026-04-02", doc_desc: "SPSI BULANAN", emp_code: "A0001", emp_name: "BUDI", amount: 4000 },
            { id: 20, doc_id: "DOC-ONLY", doc_date: "2026-04-01", doc_desc: "TUNJANGAN JABATAN", emp_code: "A0001", emp_name: "BUDI", amount: 150000 },
            { id: 30, doc_id: "DOC-OTHER", doc_date: "2026-04-01", doc_desc: "POTONGAN SPSI", emp_code: "A0002", emp_name: "ANI", amount: 4000 }
        ], ["spsi", "jabatan"]);

        expect(report).toEqual({
            duplicate_count: 1,
            duplicates: [{
                emp_code: "A0001",
                emp_name: "BUDI",
                category: "spsi",
                record_count: 2,
                keep_id: 12,
                keep_doc_id: "DOC-NEW",
                delete_ids: [10],
                delete_doc_ids: ["DOC-OLD"],
                records: [
                    { id: 10, doc_id: "DOC-OLD", doc_date: "2026-04-01", doc_desc: "POTONGAN SPSI", amount: 4000, action: "DELETE_OLD" },
                    { id: 12, doc_id: "DOC-NEW", doc_date: "2026-04-02", doc_desc: "SPSI BULANAN", amount: 4000, action: "KEEP_NEWEST" }
                ]
            }]
        });
    });

    it("queries by normalized division LocCode when emp_codes is omitted", async () => {
        const originalGetInstance = Database.getInstance;
        const calls: QueryCall[] = [];
        const mockDb = {
            query: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                return [];
            }
        };

        (Database as any).getInstance = () => mockDb;

        try {
            const result = await manualAdjustmentService.checkAdtransDirectly(4, 2026, [], ["spsi"], "PG2A");

            expect(result).toEqual({
                totals: [],
                duplicate_report: {
                    duplicate_count: 0,
                    duplicates: []
                }
            });
            expect(calls.length).toBe(2);
            expect(calls[0].sql).toContain("UPPER(RTRIM(t.LocCode)) = ?");
            expect(calls[0].sql).not.toContain("RTRIM(t.EmpCode) IN ()");
            expect(calls[0].params).toEqual(["P2A", 4, 2026, "P2A", 4, 2026]);
            expect(calls[1].params).toEqual(["P2A", 4, 2026, "%SPSI%", "P2A", 4, 2026, "%SPSI%"]);
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });

    it("matches stored auto buffer rows when compare uses a division alias", async () => {
        const originalGetInstance = Database.getInstance;
        const calls: QueryCall[] = [];
        const dbPtrj = {
            query: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                return [{ emp_code: "A0091", spsi: 4000 }];
            }
        };
        const dbExtend = {
            query: async (sql: string, params?: any[]) => {
                const queryParams = params || [];
                calls.push({ sql, params: queryParams });
                if (!queryParams.includes("P2A")) return [];
                return [{
                    emp_code: "A0091",
                    adjustment_name: "AUTO SPSI",
                    amount: 4000,
                    remarks: "AUTO SPSI | potongan spsi | 4000",
                    gang_code: "C1H",
                    division_code: "P2A"
                }];
            }
        };

        (Database as any).getInstance = (database?: string) => database ? dbExtend : dbPtrj;

        try {
            const result = await manualAdjustmentService.compareAdtransWithAdjustments(4, 2026, "PG2A", ["spsi"]);

            expect(result.comparisons).toEqual([{
                emp_code: "A0091",
                category: "spsi",
                adjustment_name: "AUTO SPSI",
                source_amount: 4000,
                stored_amount: 4000,
                diff: 0,
                status: "MATCH",
                gang_code: "C1H",
                remarks: "AUTO SPSI | potongan spsi | 4000"
            }]);
            expect(calls[1].params).toEqual([4, 2026, "PG2A", "P2A"]);
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });

    it("reports db_ptrj values as mismatch when the stored adjustment is keyed by NIK with zero amount", async () => {
        const originalGetInstance = Database.getInstance;
        const dbPtrj = {
            query: async () => [{ emp_code: "A0001", nik: "1902050504860001", spsi: 4000 }]
        };
        const dbExtend = {
            query: async () => [{
                emp_code: "1902050504860001",
                adjustment_name: "AUTO SPSI",
                amount: 0,
                remarks: "AUTO SPSI | non-spsi | 0",
                gang_code: "A2M",
                division_code: "P1A"
            }]
        };

        (Database as any).getInstance = (database?: string) => database ? dbExtend : dbPtrj;

        try {
            const result = await manualAdjustmentService.compareAdtransWithAdjustments(4, 2026, "P1A", ["spsi"]);

            expect((result as any).extra_in_db_ptrj).toBe(1);
            expect(result.mismatch_count).toBe(1);
            expect(result.missing_in_adjustments).toBe(0);
            expect(result.comparisons).toEqual([{
                emp_code: "A0001",
                category: "spsi",
                adjustment_name: "AUTO SPSI",
                source_amount: 4000,
                stored_amount: 0,
                diff: 4000,
                status: "MISMATCH",
                gang_code: "A2M",
                remarks: "AUTO SPSI | non-spsi | 0"
            }]);
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });

    it("limits virtual division compare rows to the virtual gang scope", async () => {
        const originalGetInstance = Database.getInstance;
        const dbPtrj = {
            query: async (sql: string, params?: any[]) => {
                const queryParams = params || [];
                if (queryParams.includes("B2N")) return [{ emp_code: "B0745", spsi: 4000 }];
                return [
                    { emp_code: "B0745", spsi: 4000 },
                    { emp_code: "B0001", spsi: 4000 }
                ];
            }
        };
        const dbExtend = {
            query: async () => [{
                emp_code: "B0745",
                adjustment_name: "AUTO SPSI",
                amount: 4000,
                remarks: "AUTO SPSI | potongan spsi | 4000",
                gang_code: "B2N",
                division_code: "NRS"
            }]
        };

        (Database as any).getInstance = (database?: string) => database ? dbExtend : dbPtrj;

        try {
            const result = await manualAdjustmentService.compareAdtransWithAdjustments(4, 2026, "NRS", ["spsi"]);

            expect(result.comparisons.map((item) => item.emp_code)).toEqual(["B0745"]);
            expect(result.missing_in_adjustments).toBe(0);
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });

    it("reports auto buffer rows that exist in adjustments but not in db_ptrj", async () => {
        const originalGetInstance = Database.getInstance;
        const dbExtend = {
            query: async () => [
                { emp_code: "B0745", adjustment_name: "AUTO SPSI", amount: 4000, remarks: "AUTO SPSI | potongan spsi | 4000", gang_code: "B2N", division_code: "NRS" },
                { emp_code: "B0746", adjustment_name: "AUTO SPSI", amount: 4000, remarks: "AUTO SPSI | potongan spsi | 4000", gang_code: "B2N", division_code: "NRS" },
                { emp_code: "B0747", adjustment_name: "AUTO MASA KERJA", amount: 2500, remarks: "AUTO MASA KERJA | masa kerja | 2500", gang_code: "B2N", division_code: "NRS" }
            ]
        };
        let dbPtrjCall = 0;
        const dbPtrj = {
            queryOne: async (_sql: string, params?: any[]) => {
                const identifier = params?.[0];
                if (identifier === "B0745" || identifier === "B0746" || identifier === "B0747") {
                    return { nik: "", emp_code: identifier, emp_name: "TEST" };
                }
                return null;
            },
            query: async () => {
                dbPtrjCall++;
                if (dbPtrjCall === 1) {
                    return [
                        { emp_code: "B0745", spsi: 4000, "masa kerja": 0 },
                        { emp_code: "B0747", spsi: 0, "masa kerja": 5000 }
                    ];
                }
                return [];
            }
        };

        (Database as any).getInstance = (database?: string) => database ? dbExtend : dbPtrj;

        try {
            const result = await (manualAdjustmentService as any).reverseCompareAdtransWithAdjustments(4, 2026, "NRS", ["spsi", "masa kerja"]);

            expect(result.extra_in_adjustments).toBe(1);
            expect(result.mismatch_count).toBe(1);
            expect(result.match_count).toBe(1);
            expect(result.comparisons.map((item: any) => ({ emp_code: item.emp_code, category: item.category, status: item.status }))).toEqual([
                { emp_code: "B0745", category: "spsi", status: "MATCH" },
                { emp_code: "B0746", category: "spsi", status: "EXTRA_IN_ADJUSTMENTS" },
                { emp_code: "B0747", category: "masa kerja", status: "MISMATCH" }
            ]);
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });

    it("resolves numeric adjustment identifiers to PTRJ EmpCode before reverse compare", async () => {
        const originalGetInstance = Database.getInstance;
        const calls: QueryCall[] = [];
        const dbExtend = {
            query: async () => [
                { emp_code: "1902050504860001", adjustment_name: "AUTO SPSI", amount: 4000, remarks: "AUTO SPSI | potongan spsi | 4000", gang_code: "A2M", division_code: "P1A" }
            ]
        };
        let dbPtrjCall = 0;
        const dbPtrj = {
            queryOne: async (_sql: string, params?: any[]) => {
                calls.push({ sql: _sql, params: params || [] });
                if (_sql.includes("HR_EMPLOYEE") && _sql.includes("HR_GANGLN")) {
                    return { nik: "1902050504860001", emp_code: "A0001", emp_name: "BUDI TEST", gang_code: "A2M" };
                }
                if (params?.[0] === "1902050504860001") {
                    return { nik: "1902050504860001", emp_code: "Z9999", emp_name: "BUDI OLD" };
                }
                return null;
            },
            query: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                dbPtrjCall++;
                if (dbPtrjCall === 1) return [{ emp_code: "A0001", spsi: 4000 }];
                return [];
            }
        };

        (Database as any).getInstance = (database?: string) => database ? dbExtend : dbPtrj;

        try {
            const result = await (manualAdjustmentService as any).reverseCompareAdtransWithAdjustments(4, 2026, "P1A", ["spsi"]);

            expect(result.match_count).toBe(1);
            expect(result.extra_in_adjustments).toBe(0);
            expect(result.comparisons[0].emp_code).toBe("A0001");
            expect(result.comparisons[0].stored_emp_identifier).toBe("1902050504860001");
            expect(calls.some((call) => call.sql.includes("RTRIM(t.EmpCode) IN (?)") && call.params.includes("A0001"))).toBe(true);
            expect(calls.some((call) => call.sql.includes("RTRIM(t.EmpCode) IN (?)") && call.params.includes("1902050504860001"))).toBe(false);
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });
});
