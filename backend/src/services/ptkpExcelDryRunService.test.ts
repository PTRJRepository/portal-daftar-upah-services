import { beforeAll, describe, expect, it } from "bun:test";
import type {
    ExcelPtkpParsedRow,
    PtkpEmployeeIdentity,
    PtkpHistoryProfile
} from "./ptkpExcelDryRunService";

beforeAll(() => {
    Bun.env.LOG_TO_FILE = "false";
    Bun.env.CLEAR_LOGS_ON_STARTUP = "false";
});

describe("ptkpExcelDryRunService", () => {
    it("plans update, insert, already-same, conflict, and not-found actions without writes", () => {
        const { buildExcelPtkpDryRunPlan } = require("./ptkpExcelDryRunService");
        const parsedRows: ExcelPtkpParsedRow[] = [
            {
                update_status: "READY_NIK",
                match_key_type: "NIK",
                match_key: "1111222233334444",
                nik: "1111222233334444",
                name: "BUDI",
                ptkp_status: "K/1",
                kategori_ter: "TER B",
                sources: "a.xlsx::SHEET!6=K/1"
            },
            {
                update_status: "READY_NIK",
                match_key_type: "NIK",
                match_key: "2222333344445555",
                nik: "2222333344445555",
                name: "SARI",
                ptkp_status: "TK/0",
                kategori_ter: "TER A",
                sources: "b.xlsx::SHEET!7=TK/0"
            },
            {
                update_status: "READY_NIK",
                match_key_type: "NIK",
                match_key: "3333444455556666",
                nik: "3333444455556666",
                name: "TONO",
                ptkp_status: "K/2",
                kategori_ter: "TER B",
                sources: "c.xlsx::SHEET!8=K/2"
            },
            {
                update_status: "CONFLICT",
                match_key_type: "NIK",
                match_key: "4444555566667777",
                nik: "4444555566667777",
                name: "KONFLIK",
                ptkp_status: "",
                kategori_ter: "",
                ptkp_values: "K/0;TK/0",
                sources: "d.xlsx::SHEET!9=K/0 | e.xlsx::SHEET!10=TK/0"
            },
            {
                update_status: "READY_NIK",
                match_key_type: "NIK",
                match_key: "5555666677778888",
                nik: "5555666677778888",
                name: "HILANG",
                ptkp_status: "K/0",
                kategori_ter: "TER A",
                sources: "f.xlsx::SHEET!11=K/0"
            }
        ];
        const employeeMatches = new Map<string, PtkpEmployeeIdentity[]>([
            ["NIK::1111222233334444", [{ emp_code: "A0001", nik: "1111222233334444", emp_name: "BUDI" }]],
            ["NIK::2222333344445555", [{ emp_code: "A0002", nik: "2222333344445555", emp_name: "SARI" }]],
            ["NIK::3333444455556666", [{ emp_code: "A0003", nik: "3333444455556666", emp_name: "TONO" }]]
        ]);
        const historyProfiles = new Map<string, PtkpHistoryProfile[]>([
            ["A0001", [{ id: 1, emp_code: "A0001", nik: "1111222233334444", emp_name: "BUDI OLD", ptkp_status: "TK/0", kategori_ter: "TER A" }]],
            ["A0002", [{ id: 2, emp_code: "A0002", nik: "2222333344445555", emp_name: "SARI", ptkp_status: "TK/0", kategori_ter: "TER A" }]]
        ]);

        const plan = buildExcelPtkpDryRunPlan({
            year: 2026,
            parsedRows,
            employeeMatches,
            historyProfiles
        });

        expect(plan.summary).toMatchObject({
            total_rows: 5,
            would_update: 1,
            would_insert: 1,
            already_same: 1,
            skipped: 2,
            no_write: 3,
            executable: 2,
            warnings: 1
        });
        expect(plan.rows.map(row => row.action)).toEqual([
            "READY_UPDATE",
            "ALREADY_SAME",
            "WOULD_INSERT",
            "SKIP_CONFLICT",
            "SKIP_NIK_NOT_FOUND"
        ]);
        expect(plan.rows[0].warning).toContain("name differs");
    });

    it("applies an explicit manual resolution for parsed Excel conflicts", () => {
        const { buildExcelPtkpDryRunPlan } = require("./ptkpExcelDryRunService");
        const plan = buildExcelPtkpDryRunPlan({
            year: 2026,
            parsedRows: [{
                update_status: "CONFLICT",
                match_key_type: "NIK",
                match_key: "7777888899990000",
                nik: "7777888899990000",
                name: "RESOLVED CONFLICT",
                ptkp_status: "",
                resolved_ptkp_status: "K/0",
                resolution_note: "Manual resolution: Excel PTKP source of truth, choose K/0.",
                kategori_ter: "",
                ptkp_values: "K/0;TK/0",
                sources: "x.xlsx::A!1=K/0 | y.xlsx::B!2=TK/0"
            }],
            employeeMatches: new Map([
                ["NIK::7777888899990000", [{ emp_code: "A0007", nik: "7777888899990000", emp_name: "RESOLVED CONFLICT" }]]
            ]),
            historyProfiles: new Map([
                ["A0007", [{ id: 7, emp_code: "A0007", nik: "7777888899990000", emp_name: "RESOLVED CONFLICT", ptkp_status: "TK/0", kategori_ter: "TER A" }]]
            ])
        });

        expect(plan.rows[0].action).toBe("READY_UPDATE");
        expect(plan.rows[0].new_ptkp_status).toBe("K/0");
        expect(plan.rows[0].warning).toContain("choose K/0");
    });

    it("allows name fallback only when the resolved name is unique", () => {
        const { buildExcelPtkpDryRunPlan } = require("./ptkpExcelDryRunService");
        const parsedRows: ExcelPtkpParsedRow[] = [{
            update_status: "READY_NAME_FALLBACK",
            match_key_type: "NAME",
            match_key: "NAME::JULI MARWANDI",
            nik: "",
            name: "JULI MARWANDI",
            ptkp_status: "K/0",
            kategori_ter: "TER A",
            sources: "g.xlsx::BUKIT!61=K/0"
        }];
        const historyProfiles = new Map<string, PtkpHistoryProfile[]>([
            ["A0004", [{ id: 4, emp_code: "A0004", nik: "", emp_name: "JULI MARWANDI", ptkp_status: "TK/0", kategori_ter: "TER A" }]]
        ]);

        const accepted = buildExcelPtkpDryRunPlan({
            year: 2026,
            parsedRows,
            includeNameFallback: true,
            employeeMatches: new Map([
                ["NAME::JULI MARWANDI", [{ emp_code: "A0004", nik: "", emp_name: "JULI MARWANDI" }]]
            ]),
            historyProfiles
        });
        expect(accepted.rows[0].action).toBe("READY_UPDATE");
        expect(accepted.rows[0].can_execute).toBe(true);

        const ambiguous = buildExcelPtkpDryRunPlan({
            year: 2026,
            parsedRows,
            includeNameFallback: true,
            employeeMatches: new Map([
                ["NAME::JULI MARWANDI", [
                    { emp_code: "A0004", nik: "", emp_name: "JULI MARWANDI" },
                    { emp_code: "B0004", nik: "", emp_name: "JULI MARWANDI" }
                ]]
            ]),
            historyProfiles
        });
        expect(ambiguous.rows[0].action).toBe("SKIP_AMBIGUOUS_NAME");
        expect(ambiguous.rows[0].can_execute).toBe(false);
    });

    it("uses match_key as the source NIK when the parsed nik field is blank", () => {
        const { buildExcelPtkpDryRunPlan } = require("./ptkpExcelDryRunService");
        const plan = buildExcelPtkpDryRunPlan({
            year: 2026,
            parsedRows: [{
                update_status: "READY_NIK",
                match_key_type: "NIK",
                match_key: "6666777788889999",
                nik: "",
                name: "MATCH KEY NIK",
                ptkp_status: "K/1",
                kategori_ter: "TER B"
            }],
            employeeMatches: new Map([
                ["NIK::6666777788889999", [{ emp_code: "A0006", nik: "6666777788889999", emp_name: "MATCH KEY NIK" }]]
            ]),
            historyProfiles: new Map([
                ["A0006", [{ id: 6, emp_code: "A0006", nik: "6666777788889999", emp_name: "MATCH KEY NIK", ptkp_status: "TK/0", kategori_ter: "TER A" }]]
            ])
        });

        expect(plan.rows[0].source_nik).toBe("6666777788889999");
        expect(plan.rows[0].action).toBe("READY_UPDATE");
    });

    it("maps PTKP statuses to TER categories consistently with the tax mapper", () => {
        const { mapExcelPtkpToTer } = require("./ptkpExcelDryRunService");
        expect(mapExcelPtkpToTer("TK/0")).toBe("TER A");
        expect(mapExcelPtkpToTer("K/0")).toBe("TER A");
        expect(mapExcelPtkpToTer("K/2")).toBe("TER B");
        expect(mapExcelPtkpToTer("K/3")).toBe("TER C");
    });
});
