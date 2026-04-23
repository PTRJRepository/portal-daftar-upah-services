import { describe, expect, it } from "bun:test";
import { buildLeaveSqlExpressions, classifyLeaveDay } from "./leaveRules";

describe("classifyLeaveDay", () => {
    it("counts Sunday public holiday as Minggu only", () => {
        expect(classifyLeaveDay({
            taskCode: "GA9128-TEST",
            isSunday: true,
            isHoliday: true
        })).toEqual({
            cuti_tahunan: false,
            cuti_sakit_haid: false,
            cuti_minggu: true,
            cuti_nasional: false
        });
    });

    it("keeps regular holiday as nasional when it is not Sunday", () => {
        expect(classifyLeaveDay({
            taskCode: "GA9128-TEST",
            isSunday: false,
            isHoliday: true
        })).toEqual({
            cuti_tahunan: false,
            cuti_sakit_haid: false,
            cuti_minggu: false,
            cuti_nasional: true
        });
    });

    it("still marks explicit Sunday code as Minggu", () => {
        expect(classifyLeaveDay({
            taskCode: "GA9127-TEST",
            isSunday: false,
            isHoliday: false
        }).cuti_minggu).toBe(true);
    });
});

describe("buildLeaveSqlExpressions", () => {
    it("prevents nasional double counting on Sundays in SQL expression", () => {
        const sql = buildLeaveSqlExpressions("trl", "h");

        expect(sql.cutiMinggu).toContain("DATEPART(weekday, trl.TrxDate) = 1");
        expect(sql.cutiNasional).toContain("DATEPART(weekday, trl.TrxDate) <> 1");
        expect(sql.cutiNasional).toContain("trl.TaskCode LIKE 'GA9128%'");
    });
});
