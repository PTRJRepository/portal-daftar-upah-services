import { describe, expect, test } from "bun:test";
import { parseBooleanQueryParam, parsePositiveIntegerQueryParam } from "./queryParsers";

describe("parseBooleanQueryParam", () => {
    test("returns true for enabled string values", () => {
        expect(parseBooleanQueryParam("true")).toBe(true);
        expect(parseBooleanQueryParam("1")).toBe(true);
        expect(parseBooleanQueryParam("TRUE")).toBe(true);
    });

    test("returns false for disabled string values", () => {
        expect(parseBooleanQueryParam("false")).toBe(false);
        expect(parseBooleanQueryParam("0")).toBe(false);
        expect(parseBooleanQueryParam("FALSE")).toBe(false);
    });

    test("returns null for missing or unsupported values", () => {
        expect(parseBooleanQueryParam(undefined)).toBeNull();
        expect(parseBooleanQueryParam("")).toBeNull();
        expect(parseBooleanQueryParam("maybe")).toBeNull();
    });
});

describe("parsePositiveIntegerQueryParam", () => {
    test("returns a positive integer for supported values", () => {
        expect(parsePositiveIntegerQueryParam("7")).toBe(7);
        expect(parsePositiveIntegerQueryParam(" 12 ")).toBe(12);
    });

    test("returns null for zero, negative, decimal, and unsupported values", () => {
        expect(parsePositiveIntegerQueryParam("0")).toBeNull();
        expect(parsePositiveIntegerQueryParam("-3")).toBeNull();
        expect(parsePositiveIntegerQueryParam("1.5")).toBeNull();
        expect(parsePositiveIntegerQueryParam("abc")).toBeNull();
        expect(parsePositiveIntegerQueryParam(undefined)).toBeNull();
    });
});
