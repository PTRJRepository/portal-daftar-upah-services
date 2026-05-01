import { beforeEach, describe, expect, it, mock } from "bun:test";

process.env.API_KEY_BYPASS = "test-manual-adjustment-api-key";
process.env.LOG_TO_FILE = "false";

const getAdjustments = mock(async () => [
    {
        id: 1,
        period_month: 4,
        period_year: 2026,
        emp_code: "A0001",
        nik: "1902050504860001",
        emp_name: "BUDI TEST",
        gang_code: "G1H",
        division_code: "AB1",
        adjustment_type: "PREMI",
        adjustment_name: "PREMI PRUNING",
        amount: 3000,
        metadata_json: "{\"input_type\":\"blok\",\"items\":[{\"subblok\":\"P0921\",\"gang_code\":\"G1H\",\"jumlah\":3000}],\"total_amount\":3000}"
    }
]);

const buildGroupedManualAdjustmentResponse = mock(() => ({
    summary: {
        division_count: 1,
        gang_count: 1,
        employee_count: 1,
        adjustment_count: 1
    },
    divisions: [
        {
            division_code: "AB1",
            gangs: [
                {
                    gang_code: "G1H",
                    employees: [
                        {
                            emp_code: "A0001",
                            premium_transactions: [
                                {
                                    adjustment_name: "PREMI PRUNING",
                                    subblok: "P0921",
                                    amount: 3000
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}));

const buildManualAdjustmentApiResponseRows = mock((rows: any[]) => rows.map((row) => ({
    ...row,
    estate: row.division_code,
    estate_code: row.division_code,
    division_code: "G 1",
    ad_code: "AL0001",
    ad_code_desc: "PREMI PRUNING"
})));

const searchAutomationAdjustmentOptions = mock(async () => [
    {
        category: "premi",
        adjustment_type: "PREMI",
        adjustment_name: "PREMI PRUNING",
        ad_code: "AL0001",
        description: "PREMI PRUNING",
        task_code: "AL0001AB1",
        task_desc: "(AL) PREMI PRUNING",
        base_task_code: "AL0001",
        loc_code: "AB1"
    },
    {
        category: "koreksi",
        adjustment_type: "POTONGAN_KOTOR",
        adjustment_name: "KOREKSI PANEN",
        ad_code: "DE0004",
        description: "KOREKSI PANEN",
        task_code: "DE0004AB1",
        task_desc: "(DE) POTONGAN PREMI",
        base_task_code: "DE0004",
        loc_code: "AB1"
    },
    {
        category: "potongan_upah_bersih",
        adjustment_type: "POTONGAN_BERSIH",
        adjustment_name: "POTONGAN PINJAMAN",
        ad_code: "DE0100",
        description: "POTONGAN PINJAMAN",
        task_code: "DE0100AB1",
        task_desc: "(DE) POTONGAN PINJAMAN",
        base_task_code: "DE0100",
        loc_code: "AB1"
    }
]);

mock.module("../services/manualAdjustmentService", () => ({
    manualAdjustmentService: {
        getAdjustments
    },
    buildManualAdjustmentApiResponseRows,
    buildGroupedManualAdjustmentResponse
}));

mock.module("../services/taskCodeOptionService", () => ({
    taskCodeOptionService: {
        searchAutomationAdjustmentOptions
    }
}));

describe("manual adjustment by-api-key route", () => {
    beforeEach(() => {
        getAdjustments.mockClear();
        buildGroupedManualAdjustmentResponse.mockClear();
        buildManualAdjustmentApiResponseRows.mockClear();
        searchAutomationAdjustmentOptions.mockClear();
    });

    it("passes metadata_only to the service and returns grouped metadata flag", async () => {
        const { payrollRoutes } = await import("./payroll");

        const response = await payrollRoutes.handle(new Request(
            "http://localhost/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_type=PREMI&metadata_only=true&view=grouped",
            {
                headers: {
                    "X-API-Key": "test-manual-adjustment-api-key"
                }
            }
        ));
        const body = await response.json() as any;

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.view).toBe("grouped");
        expect(body.metadata_only).toBe(true);
        expect(body.data[0].gangs[0].employees[0].premium_transactions[0]).toEqual({
            adjustment_name: "PREMI PRUNING",
            subblok: "P0921",
            amount: 3000
        });
        expect(getAdjustments).toHaveBeenCalledWith(
            4,
            2026,
            undefined,
            undefined,
            "AB1",
            "PREMI",
            undefined,
            true
        );
    });

    it("returns enriched flat rows for API key reads", async () => {
        const { payrollRoutes } = await import("./payroll");

        const response = await payrollRoutes.handle(new Request(
            "http://localhost/payroll/manual-adjustment/by-api-key?period_month=4&period_year=2026&division_code=AB1&adjustment_type=PREMI",
            {
                headers: {
                    "X-API-Key": "test-manual-adjustment-api-key"
                }
            }
        ));
        const body = await response.json() as any;

        expect(response.status).toBe(200);
        expect(body.view).toBe("flat");
        expect(body.data[0]).toMatchObject({
            estate: "AB1",
            estate_code: "AB1",
            division_code: "G 1",
            ad_code: "AL0001",
            ad_code_desc: "PREMI PRUNING"
        });
        expect(buildManualAdjustmentApiResponseRows).toHaveBeenCalledTimes(1);
    });

    it("returns adjustment name options grouped by adjustment type", async () => {
        const { payrollRoutes } = await import("./payroll");

        const response = await payrollRoutes.handle(new Request(
            "http://localhost/payroll/manual-adjustment/adjustment-name-options/by-api-key?division_code=AB1&adjustment_type=PREMI,POTONGAN_KOTOR,POTONGAN_BERSIH&limit=200",
            {
                headers: {
                    "X-API-Key": "test-manual-adjustment-api-key"
                }
            }
        ));
        const body = await response.json() as any;

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.count).toBe(3);
        expect(body.adjustment_types).toEqual(["PREMI", "POTONGAN_KOTOR", "POTONGAN_BERSIH"]);
        expect(body.adjustment_names_by_type).toEqual({
            PREMI: ["PREMI PRUNING"],
            POTONGAN_KOTOR: ["KOREKSI PANEN"],
            POTONGAN_BERSIH: ["POTONGAN PINJAMAN"]
        });
        expect(body.data.map((option: any) => option.ad_code)).toEqual(body.data.map((option: any) => option.task_desc));
        expect(body.by_type.PREMI[0]).toMatchObject({
            adjustment_type: "PREMI",
            adjustment_name: "PREMI PRUNING",
            ad_code: "(AL) PREMI PRUNING",
            task_desc: "(AL) PREMI PRUNING"
        });
        expect(searchAutomationAdjustmentOptions).toHaveBeenCalledWith({
            search: undefined,
            divisionCode: "AB1",
            limit: 200,
            categories: ["premi", "koreksi", "potongan_upah_bersih"]
        });
    });
});
