import { describe, expect, test } from "bun:test";
import { calculatePayrollTotals } from "./payrollTotalsCalculator";

describe("calculatePayrollTotals", () => {
    test("sums jumlah_upah_kotor directly from canonical rows", () => {
        const totals = calculatePayrollTotals(
            [
                {
                    jumlah_hk: 24,
                    jumlah_upah_kotor: 1_500_000,
                    pot_koreksi: 100_000,
                },
                {
                    jumlah_hk: 23,
                    jumlah_upah_kotor: 2_000_000,
                    pot_koreksi: 200_000,
                },
            ],
            "GRAND TOTAL",
        );

        // Canonical rows already carry corrected values; totals must not re-adjust koreksi.
        expect(totals.jumlah_upah_kotor).toBe(3_500_000);
    });

    test("filters out employees with jumlah_hk <= 0", () => {
        const totals = calculatePayrollTotals(
            [
                { jumlah_hk: 0, jumlah_upah_kotor: 9_999_999 },
                { jumlah_hk: 22, jumlah_upah_kotor: 1_000_000 },
            ],
            "GRAND TOTAL",
        );

        expect(totals.employee_count).toBe(1);
        expect(totals.jumlah_upah_kotor).toBe(1_000_000);
    });
});
