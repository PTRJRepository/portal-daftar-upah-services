import { describe, expect, test } from "bun:test";
import { canAccessEmployeeDetailScope } from "./employeeDetailAccess";

describe("canAccessEmployeeDetailScope", () => {
    test("allows INFRA users to open details for INF and INT gang employees", () => {
        for (const gangCode of ["INF", "INT"]) {
            expect(canAccessEmployeeDetailScope({
                userDivisions: ["INFRA"],
                requestedDivision: "INFRA",
                employeeLocCode: "P1A",
                employeeGangCode: gangCode,
                employeeGangDescription: "INFRASTRUKTUR"
            })).toBe(true);
        }
    });

    test("does not allow INFRA users to open normal PG1A gang employees", () => {
        expect(canAccessEmployeeDetailScope({
            userDivisions: ["INFRA"],
            requestedDivision: "INFRA",
            employeeLocCode: "P1A",
            employeeGangCode: "A1H",
            employeeGangDescription: "PANEN"
        })).toBe(false);
    });

    test("keeps real division access unchanged", () => {
        expect(canAccessEmployeeDetailScope({
            userDivisions: ["PG1A"],
            requestedDivision: "PG1A",
            employeeLocCode: "P1A",
            employeeGangCode: "A1H"
        })).toBe(true);
    });
});
