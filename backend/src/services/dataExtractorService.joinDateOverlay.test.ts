import { describe, expect, it } from "bun:test";
import {
    applyJoinDateSourcesToEmployees,
    buildLatestProfileJoinDateQuery,
    buildLatestValueJoinDateQuery
} from "./dataExtractorService";

describe("join date overlay resolution", () => {
    it("keeps edit-mode profile join date ahead of legacy value override and HR seed history", () => {
        const employees = [
            { emp_code: "A0001", join_date: "2020-01-01" },
            { emp_code: "A0002", join_date: null }
        ];

        applyJoinDateSourcesToEmployees(employees, {
            profileOverrideRows: [
                { emp_code: "A0001", join_date: "2025-03-15" }
            ],
            valueOverrideRows: [
                { emp_code: "A0001", join_date: "2024-01-10" },
                { emp_code: "A0002", join_date: "2023-02-20" }
            ],
            historyRows: [
                { emp_code: "A0001", join_date: "2019-12-01" },
                { emp_code: "A0002", join_date: "2021-05-01" }
            ]
        });

        expect(employees[0].join_date).toBe("2025-03-15");
        expect(employees[1].join_date).toBe("2023-02-20");
    });

    it("selects latest profile and legacy join date rows by update_index before id", () => {
        const profileSql = buildLatestProfileJoinDateQuery("'A0001','A0002'");
        expect(profileSql).toContain("ROW_NUMBER()");
        expect(profileSql).toContain("ORDER BY update_index DESC, id DESC");
        expect(profileSql).not.toContain("MAX(id)");

        const valueSql = buildLatestValueJoinDateQuery("'A0001','A0002'");
        expect(valueSql).toContain("ROW_NUMBER()");
        expect(valueSql).toContain("ORDER BY update_index DESC, id DESC");
        expect(valueSql).not.toContain("MAX(id)");
    });
});
