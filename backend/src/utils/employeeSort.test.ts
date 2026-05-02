import { describe, expect, test } from "bun:test";
import { sortAndRenumberByEmpCode, sortByEmpCode } from "./employeeSort";

describe("employee emp_code sorting", () => {
    test("sorts rows by trimmed emp_code and keeps missing codes last", () => {
        const rows = [
            { emp_code: " B0002 ", emp_name: "Beta" },
            { emp_code: "", emp_name: "No Code" },
            { emp_code: "a0001", emp_name: "Alpha" },
            { emp_code: "A0010", emp_name: "Ten" },
            { emp_code: "A0002", emp_name: "Two" }
        ];

        const sorted = sortByEmpCode(rows);

        expect(sorted.map(row => row.emp_name)).toEqual([
            "Alpha",
            "Two",
            "Ten",
            "Beta",
            "No Code"
        ]);
        expect(rows[0].emp_name).toBe("Beta");
    });

    test("renumbers no after emp_code sorting", () => {
        const rows = [
            { no: 1, emp_code: "D0003" },
            { no: 2, emp_code: "D0001" },
            { no: 3, emp_code: "D0002" }
        ];

        const sorted = sortAndRenumberByEmpCode(rows);

        expect(sorted.map(row => row.emp_code)).toEqual(["D0001", "D0002", "D0003"]);
        expect(sorted.map(row => row.no)).toEqual([1, 2, 3]);
    });
});
