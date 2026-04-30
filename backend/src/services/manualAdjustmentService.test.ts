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
                adjustment_name: "PREMI PRUNING",
                amount: 0,
                remarks: "INIT_COLUMN - Kolom ditambahkan tanpa nilai"
            })).rejects.toThrow("ADCode wajib diisi");
            expect(queryCalled).toBe(false);
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });

    it("rejects PREMI names that are not present in premium definitions before querying", async () => {
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
                adjustment_name: "PREMI RAWAT BEBAS",
                amount: 1000,
                ad_code: "AL001",
                task_desc: "(AL) PREMI MANUAL"
            })).rejects.toThrow("tidak ditemukan dalam definisi premium");
            expect(queryCalled).toBe(false);
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });

    it("normalizes free-text koreksi to fixed prefix and DE potongan premi mapping", async () => {
        const originalGetInstance = Database.getInstance;
        const originalUpsertPreset = manualAdjustmentPresetService.upsertPreset;
        const calls: QueryCall[] = [];
        const mockDb = {
            queryOne: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                return null;
            },
            query: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                return [{ id: 92 }];
            }
        };

        (Database as any).getInstance = () => mockDb;
        (manualAdjustmentPresetService as any).upsertPreset = mock(async () => 92);

        try {
            const id = await manualAdjustmentService.saveAdjustment({
                period_month: 4,
                period_year: 2026,
                emp_code: "A0001",
                gang_code: "G1H",
                adjustment_type: "POTONGAN_KOTOR",
                adjustment_name: "panen",
                amount: 1000
            });

            const insertCall = calls.find((call) => call.sql.includes("INSERT INTO dbo.payroll_manual_adjustments"));
            expect(id).toBe(92);
            expect(insertCall?.params).toContain("KOREKSI PANEN");
            expect(insertCall?.params).toContain("AD CODE: DE0004 - (DE) POTONGAN PREMI");
        } finally {
            (Database as any).getInstance = originalGetInstance;
            (manualAdjustmentPresetService as any).upsertPreset = originalUpsertPreset;
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
                adjustment_name: "PREMI CUCI MOBIL",
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
                adjustment_name: "PREMI CUCI MOBIL",
                amount: 1000,
                remarks: "PREMI CUCI MOBIL | MANUAL EDIT | 1000 | sync:MANUAL | match:MANUAL"
            });

            expect(id).toBe(90);
            expect(calls.some((call) => call.sql.includes("INSERT INTO dbo.payroll_manual_adjustments"))).toBe(true);
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });

    it("preserves existing metadata_json when an amount-only update is saved", async () => {
        const originalGetInstance = Database.getInstance;
        const calls: QueryCall[] = [];
        const mockDb = {
            queryOne: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                if (sql.includes("payroll_manual_adjustments")) {
                    return { id: 55 };
                }
                return null;
            },
            query: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                return [];
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
                adjustment_name: "PREMI PRUNING",
                amount: 123000,
                remarks: "PREMI PRUNING | MANUAL EDIT | 123000 | sync:MANUAL | match:MANUAL"
            });

            const updateCall = calls.find((call) => call.sql.includes("UPDATE dbo.payroll_manual_adjustments"));
            expect(id).toBe(55);
            expect(updateCall?.sql).toContain("metadata_json = metadata_json");
            expect(updateCall?.params).toEqual([
                123000,
                "PREMI PRUNING | MANUAL EDIT | 123000 | sync:MANUAL | match:MANUAL",
                null,
                "system",
                55
            ]);
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });

    it("updates metadata_json when structured premium detail is provided", async () => {
        const originalGetInstance = Database.getInstance;
        const calls: QueryCall[] = [];
        const mockDb = {
            queryOne: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                if (sql.includes("payroll_manual_adjustments")) {
                    return { id: 56 };
                }
                return null;
            },
            query: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                return [];
            }
        };

        (Database as any).getInstance = () => mockDb;

        try {
            const metadata = JSON.stringify({
                input_type: "blok",
                items: [{ subblok: "P0808", gang_code: "G1H", jumlah: 123000 }],
                total_amount: 123000
            });

            const id = await manualAdjustmentService.saveAdjustment({
                period_month: 4,
                period_year: 2026,
                emp_code: "A0001",
                gang_code: "G1H",
                adjustment_type: "PREMI",
                adjustment_name: "PREMI PRUNING",
                amount: 123000,
                remarks: "PREMI PRUNING | MANUAL EDIT | 123000 | sync:MANUAL | match:MANUAL",
                metadata_json: metadata
            });

            const updateCall = calls.find((call) => call.sql.includes("UPDATE dbo.payroll_manual_adjustments"));
            expect(id).toBe(56);
            expect(updateCall?.sql).toContain("metadata_json = ?");
            expect(updateCall?.params).toEqual([
                123000,
                "PREMI PRUNING | MANUAL EDIT | 123000 | sync:MANUAL | match:MANUAL",
                metadata,
                null,
                "system",
                56
            ]);
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
                adjustment_name: "PREMI PRUNING",
                amount: 1000,
                remarks: "PREMI PRUNING | MANUAL EDIT | 1000 | sync:MANUAL | match:MANUAL"
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
                adjustment_name: "PREMI JARAK",
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

    it("normalizes division_code to 3-character format when saving adjustment rows", async () => {
        const originalGetInstance = Database.getInstance;
        const calls: QueryCall[] = [];
        const mockDb = {
            queryOne: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                return null;
            },
            query: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                return [{ id: 101 }];
            }
        };

        (Database as any).getInstance = () => mockDb;

        try {
            const id = await manualAdjustmentService.saveAdjustment({
                period_month: 4,
                period_year: 2026,
                emp_code: "A0001",
                gang_code: "A1H",
                division_code: "PG1A",
                adjustment_type: "AUTO_BUFFER",
                adjustment_name: "AUTO SPSI",
                amount: 4000
            });

            expect(id).toBe(101);
            const insertCall = calls.find((call) => call.sql.includes("INSERT INTO dbo.payroll_manual_adjustments"));
            expect(insertCall?.params).toContain("P1A");
            expect(insertCall?.params).not.toContain("PG1A");
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });

    it("fetches manual adjustments using both 3-code and 4-code division formats", async () => {
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
            await manualAdjustmentService.getAdjustments(4, 2026, undefined, undefined, "P2A");
            await manualAdjustmentService.getAdjustments(4, 2026, undefined, undefined, "PG2A");
            await manualAdjustmentService.getAdjustments(4, 2026, undefined, undefined, "2A");

            expect(calls[0].sql).toContain("division_code IN");
            expect(calls[0].params.slice(2).sort()).toEqual(["P2A", "PG2A"]);
            expect(calls[1].sql).toContain("division_code IN");
            expect(calls[1].params.slice(2).sort()).toEqual(["P2A", "PG2A"]);
            expect(calls[2].sql).toContain("division_code IN");
            expect(calls[2].params.slice(2).sort()).toEqual(["P2A", "PG2A"]);
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });

    it("normalizes division_code when deleting a manual adjustment column", async () => {
        const originalGetInstance = Database.getInstance;
        const calls: QueryCall[] = [];
        const mockDb = {
            query: async (sql: string, params?: any[]) => {
                calls.push({ sql, params: params || [] });
                if (sql.includes("SELECT id FROM dbo.payroll_manual_adjustments")) {
                    return [{ id: 1 }, { id: 2 }];
                }
                return [];
            }
        };

        (Database as any).getInstance = () => mockDb;

        try {
            const deleted = await manualAdjustmentService.deleteAdjustmentColumn({
                period_month: 4,
                period_year: 2026,
                division_code: "PG1A",
                adjustment_type: "PREMI",
                adjustment_name: "PREMI PRUNING"
            });

            expect(deleted).toBe(2);
            expect(calls[0].params).toEqual([4, 2026, "PREMI", "PREMI PRUNING", "P1A"]);
            expect(calls[1].params).toEqual([4, 2026, "PREMI", "PREMI PRUNING", "P1A"]);
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

    it("maps ADTRANS DocDesc variants to comparison categories", () => {
        const report = buildAdtransDuplicateReport([
            { id: 1, doc_id: "DOC-SPSI", doc_date: "2026-04-01", doc_desc: "POTONGAN SPSI", emp_code: "A0001", emp_name: "BUDI", amount: 4000 },
            { id: 2, doc_id: "DOC-MASA", doc_date: "2026-04-01", doc_desc: "TUNJANGAN MASA KERJA", emp_code: "A0001", emp_name: "BUDI", amount: 15000 },
            { id: 3, doc_id: "DOC-JAB", doc_date: "2026-04-01", doc_desc: "TUNJANGAN JABATAN", emp_code: "A0001", emp_name: "BUDI", amount: 45000 },
            { id: 4, doc_id: "DOC-PREM", doc_date: "2026-04-01", doc_desc: "INSENTIF PANEN", emp_code: "A0001", emp_name: "BUDI", amount: 5000 },
            { id: 5, doc_id: "DOC-POT", doc_date: "2026-04-01", doc_desc: "POTONGAN ALAT", emp_code: "A0001", emp_name: "BUDI", amount: -1000 },
            { id: 6, doc_id: "DOC-KOR", doc_date: "2026-04-01", doc_desc: "KOREKSI PANEN", emp_code: "A0001", emp_name: "BUDI", amount: -2000 }
        ], ["spsi", "masa kerja", "jabatan", "premi", "potongan", "koreksi"]);

        expect(report.duplicates).toEqual([]);
    });

    it("uses ADTRANS DocDesc business rules in direct check SQL patterns", async () => {
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
            await manualAdjustmentService.checkAdtransDirectly(4, 2026, ["A0001"], ["premi", "brondol", "koreksi", "potongan"], "P1A");

            expect(calls[0].sql).toContain("LIKE '%PREMI%' OR UPPER(DocDesc) LIKE '%INSENTIF%' OR UPPER(DocDesc) LIKE '%PANEN%' OR UPPER(DocDesc) LIKE '%KINERJA%' OR UPPER(DocDesc) LIKE '%RAWAT%' OR UPPER(DocDesc) LIKE '%PRUN%'");
            expect(calls[0].sql).toContain("LIKE '%BRONDOL%'");
            expect(calls[0].sql).toContain("LIKE '%KOREKSI%'");
            expect(calls[0].sql).toContain("LIKE 'POT%' OR UPPER(DocDesc) LIKE 'POTONGAN%'");
            expect(calls[1].params).toContain("%BRONDOL%");
            expect(calls[1].params).toContain("%KOREKSI%");
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
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
                stored_emp_identifier: null,
                category: "spsi",
                adjustment_name: "AUTO SPSI",
                source_amount: 4000,
                stored_amount: 4000,
                db_ptrj_amount: 4000,
                extend_db_ptrj_amount: 4000,
                diff: 0,
                status: "MATCH",
                db_ptrj_doc_desc_details: [],
                extend_db_ptrj_remarks: "AUTO SPSI | potongan spsi | 4000",
                gang_code: "C1H",
                remarks: "AUTO SPSI | potongan spsi | 4000"
            }]);
            expect(calls.some((call) => call.sql.includes("payroll_manual_adjustments") && JSON.stringify(call.params) === JSON.stringify([4, 2026, "PG2A", "P2A"]))).toBe(true);
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
                stored_emp_identifier: "1902050504860001",
                category: "spsi",
                adjustment_name: "AUTO SPSI",
                source_amount: 4000,
                stored_amount: 0,
                db_ptrj_amount: 4000,
                extend_db_ptrj_amount: 0,
                diff: 4000,
                status: "MISMATCH",
                db_ptrj_doc_desc_details: [],
                extend_db_ptrj_remarks: "AUTO SPSI | non-spsi | 0",
                gang_code: "A2M",
                remarks: "AUTO SPSI | non-spsi | 0"
            }]);
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });

    it("includes db_ptrj DocDesc and extend remarks details in compare output", async () => {
        const originalGetInstance = Database.getInstance;
        let dbPtrjCall = 0;
        const dbPtrj = {
            query: async () => {
                dbPtrjCall++;
                if (dbPtrjCall === 1) return [{ emp_code: "A0001", nik: "1902050504860001", spsi: 0, "masa kerja": 0, jabatan: 0, premi: 7000, koreksi: 0, potongan: 0 }];
                return [
                    { emp_code: "A0001", category: "premi", doc_desc: "INSENTIF PANEN", doc_id: "AD001", amount: 5000 },
                    { emp_code: "A0001", category: "premi", doc_desc: "KINERJA", doc_id: "AD002", amount: 2000 }
                ];
            }
        };
        const dbExtend = {
            query: async () => [{
                emp_code: "1902050504860001",
                adjustment_type: "PREMI",
                adjustment_name: "INSENTIF PANEN",
                amount: 5000,
                remarks: "premi manual user",
                gang_code: "A2M",
                division_code: "P1A"
            }]
        };

        (Database as any).getInstance = (database?: string) => database ? dbExtend : dbPtrj;

        try {
            const result = await manualAdjustmentService.compareAdtransWithAdjustments(4, 2026, "P1A");
            const item = result.comparisons.find((comparison) => comparison.category === "premi");

            expect(item).toMatchObject({
                emp_code: "A0001",
                stored_emp_identifier: "1902050504860001",
                category: "premi",
                source_amount: 7000,
                stored_amount: 5000,
                diff: 2000,
                status: "MISMATCH",
                db_ptrj_amount: 7000,
                extend_db_ptrj_amount: 5000,
                extend_db_ptrj_remarks: "premi manual user"
            });
            expect((item as any).db_ptrj_doc_desc_details).toEqual([
                { doc_desc: "INSENTIF PANEN", doc_id: "AD001", amount: 5000 },
                { doc_desc: "KINERJA", doc_id: "AD002", amount: 2000 }
            ]);
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });

    it("includes premi, koreksi, and potongan missing details in compare defaults", async () => {
        const originalGetInstance = Database.getInstance;
        const dbPtrj = {
            query: async () => [{ emp_code: "A0001", nik: "1902050504860001", spsi: 0, "masa kerja": 0, jabatan: 0, premi: 5000, koreksi: -2000, potongan: -1000 }]
        };
        const dbExtend = {
            query: async () => []
        };

        (Database as any).getInstance = (database?: string) => database ? dbExtend : dbPtrj;

        try {
            const result = await manualAdjustmentService.compareAdtransWithAdjustments(4, 2026, "P1A");

            expect(result.compared_categories).toEqual(["spsi", "masa kerja", "jabatan", "premi", "koreksi", "potongan"]);
            expect(result.comparisons.map((item) => ({ emp_code: item.emp_code, category: item.category, status: item.status, source_amount: item.source_amount }))).toEqual([
                { emp_code: "A0001", category: "premi", status: "MISSING", source_amount: 5000 },
                { emp_code: "A0001", category: "koreksi", status: "MISSING", source_amount: -2000 },
                { emp_code: "A0001", category: "potongan", status: "MISSING", source_amount: -1000 }
            ]);
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

    it("includes db_ptrj DocDesc and extend remarks details in reverse compare output", async () => {
        const originalGetInstance = Database.getInstance;
        const dbExtend = {
            query: async () => [{
                emp_code: "1902050504860001",
                adjustment_type: "PREMI",
                adjustment_name: "INSENTIF PANEN",
                amount: 5000,
                remarks: "premi manual user",
                gang_code: "A2M",
                division_code: "P1A"
            }]
        };
        let dbPtrjCall = 0;
        const dbPtrj = {
            queryOne: async () => ({ nik: "1902050504860001", emp_code: "A0001", emp_name: "BUDI TEST", gang_code: "A2M" }),
            query: async () => {
                dbPtrjCall++;
                if (dbPtrjCall === 1) return [{ emp_code: "A0001", premi: 7000 }];
                return [
                    { emp_code: "A0001", category: "premi", doc_desc: "INSENTIF PANEN", doc_id: "AD001", amount: 5000 },
                    { emp_code: "A0001", category: "premi", doc_desc: "KINERJA", doc_id: "AD002", amount: 2000 }
                ];
            }
        };

        (Database as any).getInstance = (database?: string) => database ? dbExtend : dbPtrj;

        try {
            const result = await (manualAdjustmentService as any).reverseCompareAdtransWithAdjustments(4, 2026, "P1A", ["premi"]);
            const item = result.comparisons[0];

            expect(item).toMatchObject({
                emp_code: "A0001",
                stored_emp_identifier: "1902050504860001",
                category: "premi",
                source_amount: 7000,
                stored_amount: 5000,
                diff: 2000,
                status: "MISMATCH",
                db_ptrj_amount: 7000,
                extend_db_ptrj_amount: 5000,
                extend_db_ptrj_remarks: "premi manual user"
            });
            expect(item.db_ptrj_doc_desc_details).toEqual([
                { doc_desc: "INSENTIF PANEN", doc_id: "AD001", amount: 5000 },
                { doc_desc: "KINERJA", doc_id: "AD002", amount: 2000 }
            ]);
        } finally {
            (Database as any).getInstance = originalGetInstance;
        }
    });

    it("includes premi, koreksi, and potongan rows in reverse compare defaults with PTRJ EmpCode", async () => {
        const originalGetInstance = Database.getInstance;
        const dbExtend = {
            query: async () => [
                { emp_code: "1902050504860001", adjustment_type: "PREMI", adjustment_name: "INSENTIF PANEN", amount: 5000, remarks: "premi manual", gang_code: "A2M", division_code: "P1A" },
                { emp_code: "1902050504860001", adjustment_type: "POTONGAN_KOTOR", adjustment_name: "KOREKSI PANEN", amount: -2000, remarks: "koreksi manual", gang_code: "A2M", division_code: "P1A" },
                { emp_code: "1902050504860001", adjustment_type: "POTONGAN_KOTOR", adjustment_name: "POTONGAN ALAT", amount: -1000, remarks: "potongan manual", gang_code: "A2M", division_code: "P1A" }
            ]
        };
        let dbPtrjCall = 0;
        const dbPtrj = {
            queryOne: async (_sql: string) => ({ nik: "1902050504860001", emp_code: "A0001", emp_name: "BUDI TEST", gang_code: "A2M" }),
            query: async () => {
                dbPtrjCall++;
                if (dbPtrjCall === 1) return [{ emp_code: "A0001", premi: 5000, koreksi: -2000, potongan: 0 }];
                return [];
            }
        };

        (Database as any).getInstance = (database?: string) => database ? dbExtend : dbPtrj;

        try {
            const result = await (manualAdjustmentService as any).reverseCompareAdtransWithAdjustments(4, 2026, "P1A");

            expect(result.compared_categories).toEqual(["spsi", "masa kerja", "jabatan", "premi", "koreksi", "potongan"]);
            expect(result.comparisons.map((item: any) => ({ emp_code: item.emp_code, category: item.category, status: item.status }))).toEqual([
                { emp_code: "A0001", category: "premi", status: "MATCH" },
                { emp_code: "A0001", category: "koreksi", status: "MATCH" },
                { emp_code: "A0001", category: "potongan", status: "EXTRA_IN_ADJUSTMENTS" }
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
