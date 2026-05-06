import { afterEach, describe, expect, it } from "bun:test";
import { summaryService } from "./summaryService";
import { thumbprintService } from "./thumbprintService";

describe("SummaryService all-division totals", () => {
    const service = summaryService as any;
    const originalDb = service.db;
    const originalExtendDb = service.extendDb;
    const originalMillDb = service.millDb;
    const originalUseHistoryDb = service._useHistoryDb;
    const originalLoadThumbprintData = service.loadThumbprintData;
    const originalLoadJsonData = service.loadJsonData;
    const originalGetAllDivisionsPremiTotals = service.getAllDivisionsPremiTotals;
    const originalGetDivisionSummary = service.getDivisionSummary;
    const originalGetDivisionLuasHektar = service.getDivisionLuasHektar;
    const originalGetDynamicPremiInsentifPanen = service.getDynamicPremiInsentifPanen;
    const originalGetThumbprintData = thumbprintService.getThumbprintData;

    afterEach(() => {
        service.db = originalDb;
        service.extendDb = originalExtendDb;
        service.millDb = originalMillDb;
        service._useHistoryDb = originalUseHistoryDb;
        service.loadThumbprintData = originalLoadThumbprintData;
        service.loadJsonData = originalLoadJsonData;
        service.getAllDivisionsPremiTotals = originalGetAllDivisionsPremiTotals;
        service.getDivisionSummary = originalGetDivisionSummary;
        service.getDivisionLuasHektar = originalGetDivisionLuasHektar;
        service.getDynamicPremiInsentifPanen = originalGetDynamicPremiInsentifPanen;
        thumbprintService.getThumbprintData = originalGetThumbprintData;
    });

    it("aggregates repeated division rows in analysis report output", async () => {
        service.getDivisionSummary = async (_division?: string, month?: number) => {
            if (month === 4) {
                return {
                    data: [
                        {
                            division_code: "AB1",
                            description: "Air Ruak 1",
                            total_premi: 100,
                            total_lembur: 10,
                            _dynamic_premi_list: [{ header: "PREMI_A", total: 100 }]
                        },
                        {
                            division_code: "AB1",
                            description: "Air Ruak 1",
                            total_premi: 40,
                            total_lembur: 5,
                            _dynamic_premi_list: [{ header: "PREMI_A", total: 40 }]
                        },
                        {
                            division_code: "P2A",
                            description: "Parit Gunung 2A",
                            total_premi: 70,
                            total_lembur: 20,
                            _dynamic_premi_list: [{ header: "PREMI_B", total: 70 }]
                        }
                    ]
                };
            }

            return {
                data: [
                    {
                        division_code: "AB1",
                        description: "Air Ruak 1",
                        total_premi: 80,
                        total_lembur: 3,
                        _dynamic_premi_list: [{ header: "PREMI_A", total: 80 }]
                    },
                    {
                        division_code: "AB1",
                        description: "Air Ruak 1",
                        total_premi: 20,
                        total_lembur: 2,
                        _dynamic_premi_list: [{ header: "PREMI_A", total: 20 }]
                    },
                    {
                        division_code: "P2A",
                        description: "Parit Gunung 2A",
                        total_premi: 50,
                        total_lembur: 10,
                        _dynamic_premi_list: [{ header: "PREMI_B", total: 50 }]
                    }
                ]
            };
        };

        const result = await service.getAnalysisReportData(4, 2026, "all");

        expect(result.premi_ot_table).toHaveLength(2);
        expect(result.premi_ot_table[0]).toMatchObject({
            division_code: "AB1",
            description: "Air Ruak 1",
            source_row_count: 2,
            prev_premi: 100,
            curr_premi: 140,
            diff_premi: 40,
            prev_ot: 5,
            curr_ot: 15,
            diff_ot: 10,
            premi_breakdown: { PREMI_A: 140, PREMI_B: 0 }
        });
        expect(result.premi_ot_table[1]).toMatchObject({
            division_code: "P2A",
            source_row_count: 1,
            prev_premi: 50,
            curr_premi: 70,
            diff_premi: 20,
            prev_ot: 10,
            curr_ot: 20,
            diff_ot: 10,
            premi_breakdown: { PREMI_A: 0, PREMI_B: 70 }
        });
        expect(result.totals).toMatchObject({
            prev_premi: 150,
            curr_premi: 210,
            diff_premi: 60,
            prev_ot: 15,
            curr_ot: 35,
            diff_ot: 20
        });
    });

    it("uses only the latest aggregation row per gang so workshop totals are not doubled", async () => {
        const duplicateHmcRows = [
            {
                id: 10,
                gang_code: "HMC",
                division_code: "AB2",
                total_premi: 100,
                total_employees: 5,
                total_hk: 12,
                total_upah_bersih: 2700,
                total_pph21: 20,
                total_spsi: 10,
                total_lembur: 300,
                total_premi_brondol: 0,
                total_premi_prunning: 0,
                total_premi_insentif: 0,
                total_premi_kinerja: 0,
                total_koreksi: 0,
                total_ffb_weight: 0,
                total_weight_tbs: 0
            },
            {
                id: 11,
                gang_code: "HMC",
                division_code: "AB2",
                total_premi: 100,
                total_employees: 5,
                total_hk: 12,
                total_upah_bersih: 2700,
                total_pph21: 20,
                total_spsi: 10,
                total_lembur: 300,
                total_premi_brondol: 0,
                total_premi_prunning: 0,
                total_premi_insentif: 0,
                total_premi_kinerja: 0,
                total_koreksi: 0,
                total_ffb_weight: 0,
                total_weight_tbs: 0
            }
        ];

        const fakeExtendDb = {
            query: async (sql: string) => {
                if (sql.includes("[dbo].[Divisi_Description]")) {
                    return [{ Divisi: "WKS_AR", Description: "WORKSHOP AIR RUAK" }];
                }

                if (sql.includes("dbo.history_hr_gang")) {
                    return [{ gang_code: "HMC", loc_code: "AB2", gang_description: "WORKSHOP AIR RUAK" }];
                }

                if (sql.includes("SELECT h.gang_code, h.division_code, h.dynamic_premi_data")) {
                    return [];
                }

                if (sql.includes("dbo.daftar_upah_aggregation_history")) {
                    return sql.includes("ROW_NUMBER() OVER")
                        ? [duplicateHmcRows[1]]
                        : duplicateHmcRows;
                }

                return [];
            }
        };

        service.extendDb = fakeExtendDb;
        service.db = fakeExtendDb;
        service.millDb = { query: async () => [] };

        const rows = await summaryService.getAllDivisionsPremiTotals(4, 2026, true);
        const workshopAirRuak = rows.find(row => row.division_code === "WKS_AR");

        expect(workshopAirRuak?.total_employees).toBe(5);
        expect(workshopAirRuak?.total_hk).toBe(12);
        expect(workshopAirRuak?.total_upah_bersih).toBe(2700);
        expect(workshopAirRuak?.total_lembur).toBe(300);
    });

    it("rejects manual PPH21 edits so summary PPH stays aligned with seeded Daftar Upah", async () => {
        service.extendDb = { query: async () => ({ affectedRows: 1 }) };

        await expect(summaryService.updateGangCell(
            4,
            2026,
            "A01",
            "total_pph21",
            123
        )).rejects.toThrow("Invalid field: total_pph21");
    });

    it("uses only the latest aggregation row for dynamic-premi backfill", async () => {
        const dynamicPremi = JSON.stringify([
            { header: "PREMI PRUNING", total: 10 },
            { header: "INSENTIF PANEN", total: 20 },
            { header: "KINERJA", total: 30 },
            { header: "OVERTIME", total: 40 }
        ]);
        const duplicateRows = [
            { id: 10, gang_code: "A01", division_code: "P1A", dynamic_premi_data: dynamicPremi, informasi_tambahan: null },
            { id: 11, gang_code: "A01", division_code: "P1A", dynamic_premi_data: dynamicPremi, informasi_tambahan: null }
        ];

        service.extendDb = {
            query: async (sql: string) => {
                if (sql.includes("[dbo].[Divisi_Description]")) {
                    return [{ Divisi: "P1A", Description: "ESTATE PARIT GUNUNG 1A" }];
                }

                if (sql.includes("dbo.history_hr_gang")) {
                    return [{ gang_code: "A01", loc_code: "P1A", gang_description: "AFD A01" }];
                }

                if (sql.includes("dbo.daftar_upah_aggregation_history")) {
                    return sql.includes("ROW_NUMBER() OVER")
                        ? [duplicateRows[1]]
                        : duplicateRows;
                }

                return [];
            }
        };

        const result = await service.getBackfillData(4, 2026);

        expect(result.PG1A).toEqual({
            pruning: 10,
            insentif: 20,
            kinerja: 30,
            lembur: 40
        });
    });

    it("uses only the latest aggregation row for impact-report insentif panen", async () => {
        const dynamicPremi = JSON.stringify([{ header: "INSENTIF PANEN", total: 20 }]);
        const duplicateRows = [
            { id: 10, gang_code: "A01", division_code: "P1A", dynamic_premi_data: dynamicPremi, informasi_tambahan: null },
            { id: 11, gang_code: "A01", division_code: "P1A", dynamic_premi_data: dynamicPremi, informasi_tambahan: null }
        ];

        service.extendDb = {
            query: async (sql: string) => {
                if (sql.includes("[dbo].[Divisi_Description]")) {
                    return [{ Divisi: "P1A", Description: "ESTATE PARIT GUNUNG 1A" }];
                }

                if (sql.includes("dbo.history_hr_gang")) {
                    return [{ gang_code: "A01", loc_code: "P1A", gang_description: "AFD A01" }];
                }

                if (sql.includes("dbo.daftar_upah_aggregation_history")) {
                    return sql.includes("ROW_NUMBER() OVER")
                        ? [duplicateRows[1]]
                        : duplicateRows;
                }

                return [];
            }
        };

        const result = await service.getDynamicPremiInsentifPanen(4, 2026);

        expect(result.PG1A).toEqual({ insentif_panen: 20 });
    });

    it("uses latest aggregation and payroll-history rows for gang detailed analysis", async () => {
        const queries: string[] = [];
        service.extendDb = {
            query: async (sql: string) => {
                queries.push(sql);
                return [];
            }
        };

        const result = await summaryService.getGangDetailedAnalysis("A01", 4, 2026);

        expect(result.success).toBe(true);
        expect(queries[0]).toContain("ROW_NUMBER() OVER");
        expect(queries[0]).toContain("PARTITION BY h.period_month, h.period_year, h.gang_code");
        expect(queries[0]).toContain("row_rank = 1");
        expect(queries[1]).toContain("WITH latest_header AS");
        expect(queries[1]).toContain("ROW_NUMBER() OVER");
        expect(queries[1]).toContain("h.row_rank = 1");
    });

    it("attaches division thumbprint and selisih to gang summary rows", async () => {
        service.extendDb = {
            query: async (sql: string) => {
                if (sql.includes("dbo.history_hr_gang")) {
                    return [
                        { gang_code: "A01", gang_description: "Gang Panen P1A" },
                        { gang_code: "A02", gang_description: "Gang Rawat P1A" }
                    ];
                }

                if (sql.includes("dbo.daftar_upah_aggregation_history")) {
                    return [
                        {
                            id: 1,
                            period_month: 4,
                            period_year: 2026,
                            division_code: "P1A",
                            gang_code: "A01",
                            gang_description: "A01",
                            total_employees: 3,
                            total_hk: 10,
                            total_lembur: 0,
                            total_premi_brondol: 0,
                            total_premi_prunning: 0,
                            total_premi_insentif: 0,
                            total_premi_kinerja: 0,
                            total_premi: 100,
                            dynamic_premi_data: null,
                            informasi_tambahan: null,
                            total_koreksi: 0,
                            total_potongan: 0,
                            total_pph21: 0,
                            total_spsi: 0,
                            total_upah_bersih: 700
                        },
                        {
                            id: 2,
                            period_month: 4,
                            period_year: 2026,
                            division_code: "P1A",
                            gang_code: "A02",
                            gang_description: "A02",
                            total_employees: 2,
                            total_hk: 8,
                            total_lembur: 0,
                            total_premi_brondol: 0,
                            total_premi_prunning: 0,
                            total_premi_insentif: 0,
                            total_premi_kinerja: 0,
                            total_premi: 50,
                            dynamic_premi_data: null,
                            informasi_tambahan: null,
                            total_koreksi: 0,
                            total_potongan: 0,
                            total_pph21: 0,
                            total_spsi: 0,
                            total_upah_bersih: 500
                        }
                    ];
                }

                return [];
            }
        };
        service.loadThumbprintData = async () => ({ P1A: 1000 });

        const result = await summaryService.getDivisionSummary(undefined, 4, 2026, true);

        expect(result.data.map((row: any) => row.thumb_print)).toEqual([1000, 1000]);
        expect(result.data.map((row: any) => row.selisih)).toEqual([200, 200]);
        expect(result.grand_total.thumb_print).toBe(1000);
        expect(result.grand_total.selisih).toBe(200);
    });

    it("uses mill tonase for previous comparison month even when payroll aggregation is not seeded", async () => {
        const currentAggregationRows = [
            {
                gang_code: "A1H",
                division_code: "AB1",
                total_premi: 100,
                total_employees: 137,
                total_hk: 177,
                total_upah_bersih: 709816634,
                total_pph21: 0,
                total_spsi: 0,
                total_lembur: 0,
                total_premi_brondol: 0,
                total_premi_prunning: 0,
                total_premi_insentif: 0,
                total_premi_kinerja: 0,
                total_koreksi: 0,
                total_ffb_weight: 0,
                total_weight_tbs: 0
            }
        ];

        service.extendDb = {
            query: async (sql: string, params?: any[]) => {
                if (sql.includes("[dbo].[Divisi_Description]")) {
                    return [{ Divisi: "AB1", Description: "Air Ruak B1" }];
                }

                if (sql.includes("dbo.history_hr_gang")) {
                    return [{ gang_code: "A1H", loc_code: "AB1", gang_description: "Air Ruak B1" }];
                }

                if (sql.includes("h.dynamic_premi_data")) {
                    return [];
                }

                if (sql.includes("dbo.daftar_upah_aggregation_history")) {
                    return params?.[0] === 4 ? currentAggregationRows : [];
                }

                return [];
            }
        };

        service.db = service.extendDb;
        service.millDb = {
            query: async (_sql: string, params?: any[]) => {
                const requestedMonth = params?.[0];
                return [
                    {
                        CustomerCode: "PTRJ05",
                        SupplierName: "PTRJ - AB1 - ESTATE AIR RUAK B1",
                        total_weight: requestedMonth === 3 ? "1618.34" : "2496.16"
                    }
                ];
            }
        };
        service.loadThumbprintData = async () => ({ AB1: 0 });
        thumbprintService.getThumbprintData = async () => ({ AB1: 690271539 });

        const result = await summaryService.getAllDivisionsComparison(4, 2026);
        const airRuakB1 = result.divisions.find((row: any) => row.division_code === "AB1");

        expect(airRuakB1?.previous_month.tbs_weight).toBe(1618.34);
        expect(airRuakB1?.current_month.tbs_weight).toBe(2496.16);
    });

    it("keeps stored extend_db_ptrj tonase when mill lookup has no match", async () => {
        const aggregationRows = [{
            gang_code: "A1H",
            division_code: "AB1",
            total_premi: 100,
            total_employees: 137,
            total_hk: 177,
            total_upah_bersih: 709816634,
            total_pph21: 0,
            total_spsi: 0,
            total_lembur: 0,
            total_premi_brondol: 0,
            total_premi_prunning: 0,
            total_premi_insentif: 0,
            total_premi_kinerja: 0,
            total_koreksi: 0,
            total_ffb_weight: 1618.34,
            total_weight_tbs: 1618.34
        }];

        service.extendDb = {
            query: async (sql: string) => {
                if (sql.includes("[dbo].[Divisi_Description]")) {
                    return [{ Divisi: "AB1", Description: "Air Ruak B1" }];
                }

                if (sql.includes("dbo.history_hr_gang")) {
                    return [{ gang_code: "A1H", loc_code: "AB1", gang_description: "Air Ruak B1" }];
                }

                if (sql.includes("h.dynamic_premi_data")) {
                    return [];
                }

                if (sql.includes("dbo.daftar_upah_aggregation_history")) {
                    return aggregationRows;
                }

                return [];
            }
        };

        service.db = service.extendDb;
        service.millDb = { query: async () => [] };
        service.loadThumbprintData = async () => ({ AB1: 0 });

        const result = await summaryService.getAllDivisionsPremiTotals(3, 2026);
        const airRuakB1 = result.find((row: any) => row.division_code === "AB1");

        expect(airRuakB1?.total_ffb_weight).toBe(1618.34);
        expect(airRuakB1?.total_weight_tbs).toBe(1618.34);
    });

    it("includes previous premi breakdown values in division comparison rows", async () => {
        const rowsByMonth: Record<number, any[]> = {
            3: [{
                gang_code: "A1H",
                division_code: "AB1",
                total_premi: 1000,
                total_employees: 10,
                total_hk: 20,
                total_upah_bersih: 5000,
                total_pph21: 0,
                total_spsi: 0,
                total_lembur: 75,
                total_premi_brondol: 100,
                total_premi_prunning: 200,
                total_premi_insentif: 300,
                total_premi_kinerja: 400,
                total_koreksi: 0,
                total_ffb_weight: 0,
                total_weight_tbs: 0
            }],
            4: [{
                gang_code: "A1H",
                division_code: "AB1",
                total_premi: 1500,
                total_employees: 12,
                total_hk: 22,
                total_upah_bersih: 6500,
                total_pph21: 0,
                total_spsi: 0,
                total_lembur: 125,
                total_premi_brondol: 125,
                total_premi_prunning: 225,
                total_premi_insentif: 325,
                total_premi_kinerja: 425,
                total_koreksi: 0,
                total_ffb_weight: 0,
                total_weight_tbs: 0
            }]
        };

        service.extendDb = {
            query: async (sql: string, params?: any[]) => {
                if (sql.includes("[dbo].[Divisi_Description]")) {
                    return [{ Divisi: "AB1", Description: "Air Ruak B1" }];
                }

                if (sql.includes("dbo.history_hr_gang")) {
                    return [{ gang_code: "A1H", loc_code: "AB1", gang_description: "Air Ruak B1" }];
                }

                if (sql.includes("h.dynamic_premi_data")) {
                    return [];
                }

                if (sql.includes("dbo.daftar_upah_aggregation_history")) {
                    return rowsByMonth[Number(params?.[0])] || [];
                }

                return [];
            }
        };

        service.db = service.extendDb;
        service.millDb = { query: async () => [] };
        service.loadThumbprintData = async () => ({ AB1: 0 });
        thumbprintService.getThumbprintData = async () => ({ AB1: 5000 });

        const result = await summaryService.getAllDivisionsComparison(4, 2026);
        const airRuakB1 = result.divisions.find((row: any) => row.division_code === "AB1");

        expect(airRuakB1?.total_prunning_previous).toBe(200);
        expect(airRuakB1?.total_brondol_previous).toBe(100);
        expect(airRuakB1?.total_insentif_previous).toBe(300);
        expect(airRuakB1?.total_kinerja_previous).toBe(400);
        expect(airRuakB1?.total_lembur_previous).toBe(75);
    });

    it("backfills previous IJL impact HK and insentif from payroll history when aggregation values are zero", async () => {
        service.loadJsonData = async (filename: string) => filename === "payrate.json"
            ? { "2026": 134500 }
            : {};
        service.getDivisionLuasHektar = async () => ({ IJL: 10 });
        service.getDynamicPremiInsentifPanen = async () => ({});
        thumbprintService.getThumbprintData = async () => ({ IJL: 240657478 });

        service.getAllDivisionsPremiTotals = async (month: number) => {
            if (month === 4) {
                return [{
                    division_code: "IJL",
                    description: "PT. IMPIAN JAYA LESTARI",
                    total_employees: 12,
                    total_hk: 250,
                    total_upah_bersih: 226874700,
                    total_premi_excluding_special: 1000,
                    total_lembur: 125,
                    total_premi_prunning: 225,
                    total_premi_insentif: 325,
                    total_ffb_weight: 0
                }];
            }

            if (month === 3) {
                return [{
                    division_code: "IJL",
                    description: "PT. IMPIAN JAYA LESTARI",
                    total_employees: 11,
                    total_hk: 0,
                    total_upah_bersih: 0,
                    total_premi_excluding_special: 0,
                    total_lembur: 0,
                    total_premi_prunning: 0,
                    total_premi_insentif: 0,
                    total_ffb_weight: 0
                }];
            }

            return [];
        };

        service.extendDb = {
            query: async (sql: string) => {
                if (sql.includes("dbo.payroll_history_header")) {
                    return [{
                        division_code: "L",
                        gang_code: "L01",
                        gang_description: "IJL PANEN",
                        total_employees: 11,
                        total_hk: 198,
                        total_premi_insentif: 0,
                        dynamic_premi_data: JSON.stringify([{ header: "INSENTIF PANEN", total: 45600 }]),
                        informasi_tambahan: null
                    }];
                }

                return [];
            }
        };
        service.millDb = { query: async () => [] };

        const result = await summaryService.getImpactReportData(4, 2026);
        const ijl = result.main_table.find((row: any) => row.division_code === "IJL");

        expect(ijl?.hk_prev).toBe(198);
        expect(ijl?.insentif_prev).toBe(45600);
    });

    it("uses extend_db_ptrj tonase for previous impact month when report aggregation tonase is zero", async () => {
        service.loadJsonData = async (filename: string) => filename === "payrate.json"
            ? { "2026": 134500 }
            : {};
        service.getDivisionLuasHektar = async () => ({ AB1: 25 });
        service.getDynamicPremiInsentifPanen = async () => ({});
        thumbprintService.getThumbprintData = async () => ({ AB1: 690271539 });

        service.getAllDivisionsPremiTotals = async (month: number) => {
            if (month === 4) {
                return [{
                    division_code: "AB1",
                    description: "Air Ruak B1",
                    total_employees: 137,
                    total_hk: 177,
                    total_upah_bersih: 709816634,
                    total_premi_excluding_special: 100,
                    total_lembur: 0,
                    total_premi_prunning: 0,
                    total_premi_insentif: 0,
                    total_ffb_weight: 2496.16,
                    total_weight_tbs: 2496.16
                }];
            }

            if (month === 3) {
                return [{
                    division_code: "AB1",
                    description: "Air Ruak B1",
                    total_employees: 137,
                    total_hk: 177,
                    total_upah_bersih: 0,
                    total_premi_excluding_special: 0,
                    total_lembur: 0,
                    total_premi_prunning: 0,
                    total_premi_insentif: 0,
                    total_ffb_weight: 0,
                    total_weight_tbs: 0
                }];
            }

            return [];
        };

        service.extendDb = {
            query: async (sql: string) => {
                if (sql.includes("[dbo].[Divisi_Description]")) {
                    return [{ Divisi: "AB1", Description: "Air Ruak B1" }];
                }

                if (sql.includes("dbo.history_hr_gang")) {
                    return [{ gang_code: "A1H", loc_code: "AB1", gang_description: "Air Ruak B1" }];
                }

                if (sql.includes("dbo.payroll_history_header")) {
                    return [];
                }

                if (sql.includes("dbo.daftar_upah_aggregation_history")) {
                    return [{
                        division_code: "AB1",
                        gang_code: "A1H",
                        total_ffb_weight: 1618.34,
                        total_weight_tbs: 1618.34
                    }];
                }

                return [];
            }
        };
        service.millDb = { query: async () => [] };

        const result = await summaryService.getImpactReportData(4, 2026);
        const airRuakB1 = result.main_table.find((row: any) => row.division_code === "AB1");

        expect(airRuakB1?.tbs_prev).toBe(1618.34);
        expect(airRuakB1?.tbs_diff).toBeCloseTo(877.82, 2);
    });

    it("falls back to Wages Comparison tonase source when extend_db_ptrj previous tonase is empty", async () => {
        service.loadJsonData = async (filename: string) => filename === "payrate.json"
            ? { "2026": 134500 }
            : {};
        service.getDivisionLuasHektar = async () => ({ DME: 30 });
        service.getDynamicPremiInsentifPanen = async () => ({});
        thumbprintService.getThumbprintData = async () => ({ DME: 832604748 });

        service.getAllDivisionsPremiTotals = async (month: number) => {
            if (month === 4) {
                return [{
                    division_code: "DME",
                    description: "Darrur Makmur Estate",
                    total_employees: 100,
                    total_hk: 160,
                    total_upah_bersih: 886101179,
                    total_premi_excluding_special: 100,
                    total_lembur: 0,
                    total_premi_prunning: 0,
                    total_premi_insentif: 0,
                    total_ffb_weight: 2059.71,
                    total_weight_tbs: 2059.71
                }];
            }

            if (month === 3) {
                return [{
                    division_code: "DME",
                    description: "Darrur Makmur Estate",
                    total_employees: 100,
                    total_hk: 160,
                    total_upah_bersih: 0,
                    total_premi_excluding_special: 0,
                    total_lembur: 0,
                    total_premi_prunning: 0,
                    total_premi_insentif: 0,
                    total_ffb_weight: 0,
                    total_weight_tbs: 0
                }];
            }

            return [];
        };

        service.extendDb = {
            query: async (sql: string) => {
                if (sql.includes("[dbo].[Divisi_Description]")) {
                    return [{ Divisi: "DME", Description: "Darrur Makmur Estate" }];
                }

                if (sql.includes("dbo.history_hr_gang")) {
                    return [{ gang_code: "E01", loc_code: "DME", gang_description: "DME Panen" }];
                }

                return [];
            }
        };
        service.millDb = {
            query: async (_sql: string, params?: any[]) => {
                const requestedMonth = params?.[0];
                return [{
                    CustomerCode: "PTRJ09",
                    SupplierName: "PTRJ - DME1 - ESTATE DARUR MAKMUR 1",
                    total_weight: requestedMonth === 3 ? "1542.01" : "2059.71"
                }];
            }
        };

        const result = await summaryService.getImpactReportData(4, 2026);
        const dme = result.main_table.find((row: any) => row.division_code === "DME");

        expect(dme?.tbs_prev).toBe(1542.01);
        expect(dme?.tbs_diff).toBeCloseTo(517.7, 2);
    });
});
