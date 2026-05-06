import { afterEach, describe, expect, it } from "bun:test";
import { dashboardService } from "./dashboardService";

describe("DashboardService aggregation reads", () => {
    const service = dashboardService as any;
    const originalExtendDb = service.extendDb;
    const originalGetGangProduction = service.getGangProduction;
    const originalGetHarvesterBunches = service.getHarvesterBunches;

    afterEach(() => {
        service.extendDb = originalExtendDb;
        service.getGangProduction = originalGetGangProduction;
        service.getHarvesterBunches = originalGetHarvesterBunches;
    });

    it("uses latest aggregation rows for division breakdown totals", async () => {
        let sql = "";
        service.extendDb = {
            query: async (query: string) => {
                sql = query;
                return [];
            }
        };

        await dashboardService.getDivisionBreakdown(4, 2026);

        expect(sql).toContain("ROW_NUMBER() OVER");
        expect(sql).toContain("PARTITION BY h.period_month, h.period_year, h.gang_code");
        expect(sql).toContain("FROM latest_rows h");
        expect(sql).toContain("h.row_rank = 1");
    });

    it("uses latest aggregation rows for gang comparison totals", async () => {
        let sql = "";
        service.extendDb = {
            query: async (query: string) => {
                sql = query;
                return [{
                    gang_code: "A01",
                    gang_description: "AFD A01",
                    total_wage: 100,
                    total_hk: 2,
                    headcount: 1,
                    total_ot: 0,
                    total_premi: 0,
                    total_production_db: 0
                }];
            }
        };
        service.getGangProduction = async () => new Map();
        service.getHarvesterBunches = async () => new Map();

        const rows = await dashboardService.getGangComparison(4, 2026);

        expect(sql).toContain("ROW_NUMBER() OVER");
        expect(sql).toContain("FROM latest_rows agg");
        expect(sql).toContain("agg.row_rank = 1");
        expect(rows[0].cost_per_hk).toBe(50);
    });
});
