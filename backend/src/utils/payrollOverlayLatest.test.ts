import { describe, expect, it } from "bun:test";
import {
    pickLatestSnapshotVersion,
    pickLatestProfileOverrides,
    pickLatestValueOverrides,
    resolveSnapshotVersion
} from "./payrollOverlayLatest";

describe("payrollOverlayLatest", () => {
    it("keeps the highest update_index per emp_code", () => {
        const latest = pickLatestProfileOverrides([
            { emp_code: "B0001", update_index: 1, is_spsi_member: false },
            { emp_code: "B0001", update_index: 3, is_spsi_member: true }
        ] as any);

        expect(latest.get("B0001")?.is_spsi_member).toBe(true);
    });

    it("keeps the highest update_index per period scope and field", () => {
        const latest = pickLatestValueOverrides([
            {
                emp_code: "B0001",
                field_name: "premi_dynamic",
                update_index: 2,
                numeric_value: 9000,
                period_month: 4,
                period_year: 2026,
                division_code: "AB1",
                gang_code: "A1"
            },
            {
                emp_code: "B0001",
                field_name: "premi_dynamic",
                update_index: 4,
                numeric_value: 12000,
                period_month: 4,
                period_year: 2026,
                division_code: "AB1",
                gang_code: "A1"
            }
        ] as any);

        expect(latest.get("2026:4:AB1:A1:B0001:premi_dynamic")?.numeric_value).toBe(12000);
    });

    it("returns the highest snapshot version for a scope", () => {
        expect(pickLatestSnapshotVersion([
            { snapshot_version: 1 },
            { snapshot_version: 3 },
            { snapshot_version: 2 }
        ] as any)).toBe(3);
    });

    it("returns the requested snapshot version when it exists", () => {
        expect(resolveSnapshotVersion([
            { snapshot_version: 1 },
            { snapshot_version: 3 },
            { snapshot_version: 2 }
        ] as any, 2)).toBe(2);
    });

    it("returns null when the requested snapshot version does not exist", () => {
        expect(resolveSnapshotVersion([
            { snapshot_version: 1 },
            { snapshot_version: 3 },
            { snapshot_version: 2 }
        ] as any, 7)).toBeNull();
    });
});
