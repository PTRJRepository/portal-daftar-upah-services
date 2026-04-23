import { describe, expect, it } from "bun:test";
import {
    DayType,
    isReligiousHolidayDescription,
    resolveOvertimeDayType
} from "./lemburCalculator";

describe("resolveOvertimeDayType", () => {
    it("prioritizes religious holiday over Sunday rate", () => {
        const sunday = new Date("2026-03-22T00:00:00");
        expect(resolveOvertimeDayType(sunday, { is_religious: true })).toBe(DayType.HOLIDAY_RELIGIOUS);
    });

    it("uses regular holiday rate only for non religious holidays", () => {
        const sunday = new Date("2026-08-16T00:00:00");
        expect(resolveOvertimeDayType(sunday, { is_religious: false })).toBe(DayType.HOLIDAY_REGULAR);
    });

    it("falls back to Sunday when there is no holiday", () => {
        const sunday = new Date("2026-08-09T00:00:00");
        expect(resolveOvertimeDayType(sunday, null)).toBe(DayType.SUNDAY);
    });

    it("classifies Friday as short workday when no holiday exists", () => {
        const friday = new Date("2026-08-07T00:00:00");
        expect(resolveOvertimeDayType(friday, null)).toBe(DayType.WORKDAY_SHORT);
    });
});

describe("isReligiousHolidayDescription", () => {
    it("detects religious holiday descriptions", () => {
        expect(isReligiousHolidayDescription("Idul Fitri 1447 H")).toBe(true);
        expect(isReligiousHolidayDescription("Hari Buruh Nasional")).toBe(false);
    });
});
