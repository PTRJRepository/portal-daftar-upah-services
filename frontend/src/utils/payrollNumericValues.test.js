import { describe, expect, it } from "vitest";
import {
  parsePayrollInputNumber,
  resolvePersistentOriginalNumber,
  toFinitePayrollNumber,
} from "./payrollNumericValues";

describe("toFinitePayrollNumber", () => {
  it("returns finite numeric values", () => {
    expect(toFinitePayrollNumber(1200)).toBe(1200);
    expect(toFinitePayrollNumber("2500")).toBe(2500);
    expect(toFinitePayrollNumber("1,250")).toBe(1250);
  });

  it("returns zero for invalid values", () => {
    expect(toFinitePayrollNumber(null)).toBe(0);
    expect(toFinitePayrollNumber(undefined)).toBe(0);
    expect(toFinitePayrollNumber("")).toBe(0);
    expect(toFinitePayrollNumber("abc")).toBe(0);
  });
});

describe("parsePayrollInputNumber", () => {
  it("parses valid input strings and numbers", () => {
    expect(parsePayrollInputNumber("5000")).toBe(5000);
    expect(parsePayrollInputNumber("5,000")).toBe(5000);
    expect(parsePayrollInputNumber(5000)).toBe(5000);
  });

  it("keeps dot-only native numeric input as a decimal value", () => {
    expect(parsePayrollInputNumber("5.000")).toBe(5);
    expect(parsePayrollInputNumber("10.000")).toBe(10);
  });

  it("supports decimal input with both dot and comma separators", () => {
    expect(parsePayrollInputNumber("5.5")).toBe(5.5);
    expect(parsePayrollInputNumber("5,5")).toBe(5.5);
    expect(parsePayrollInputNumber("1,250.75")).toBe(1250.75);
    expect(parsePayrollInputNumber("1.250,75")).toBe(1250.75);
  });

  it("maps empty value to zero and keeps invalid as null", () => {
    expect(parsePayrollInputNumber("")).toBe(0);
    expect(parsePayrollInputNumber("   ")).toBe(0);
    expect(parsePayrollInputNumber("abc")).toBeNull();
  });
});

describe("resolvePersistentOriginalNumber", () => {
  it("keeps the first original value during repeated edits", () => {
    const originalFromRow = resolvePersistentOriginalNumber(undefined, 7000);
    const originalAfterNextEdit = resolvePersistentOriginalNumber(originalFromRow, 70000);

    expect(originalFromRow).toBe(7000);
    expect(originalAfterNextEdit).toBe(7000);
  });
});
