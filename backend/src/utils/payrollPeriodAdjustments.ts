/**
 * payrollPeriodAdjustments.ts
 *
 * Helpers for period-specific payroll adjustments:
 *   - resolveAdjustedJabatanJumlah : resolve the tunjangan jabatan amount for an employee,
 *     applying any period-specific override when present.
 *   - shouldForcePotPph21ToTer     : decide whether the PPh21 deduction for an employee
 *     should be forced to the recalculated TER value (instead of the stored pot_pph21).
 *   - attachPayrollPeriodAdjustmentNotes : annotate an employee row with the adjustment
 *     notes/flags used by downstream reports.
 *
 * STATUS: STUB — this module was imported by taxReportService and taxReportRoutes but
 * was never committed to git. These stubs preserve existing behavior (no override, no
 * force-to-TER, no notes) so the backend boots and tax reports run without crashing.
 *
 * TODO: Replace with the real period-adjustment logic once available. Until then:
 *   - resolveAdjustedJabatanJumlah returns the fallback amount as-is.
 *   - shouldForcePotPph21ToTer returns false (use the stored pot_pph21 deduction).
 *   - attachPayrollPeriodAdjustmentNotes is a no-op.
 */

export interface PayrollPeriodContext {
    month: number;
    year: number;
    divisionCode?: string;
}

/**
 * Resolve the tunjangan jabatan (jabatan_jumlah) for an employee, honoring any
 * period-specific override. Stub returns the fallback amount unchanged.
 *
 * @param emp          Employee row (may carry override fields in the real impl).
 * @param ctx          Period context { month, year, divisionCode }.
 * @param fallback     Default jabatan jumlah when no override applies.
 * @returns            The resolved jabatan jumlah (Number-coerced).
 */
export function resolveAdjustedJabatanJumlah(
    emp: any,
    ctx: PayrollPeriodContext,
    fallback: number
): number {
    const base = Number(fallback);
    if (!Number.isFinite(base)) return 0;
    return base;
}

/**
 * Decide whether the PPh21 deduction should be forced to the recalculated TER
 * value for this employee/period. Stub returns false so the stored pot_pph21
 * is used (matches pre-stub behavior where the ternary fell back to pot_pph21).
 *
 * @param emp  Employee row.
 * @param ctx  Period context { month, year, divisionCode }.
 * @returns    true to force pot_pph21 := pph21_ter; false to keep stored pot_pph21.
 */
export function shouldForcePotPph21ToTer(
    emp: any,
    ctx: PayrollPeriodContext
): boolean {
    return false;
}

/**
 * Attach period-adjustment notes/flags to an employee row for downstream reports.
 * Stub is a no-op; the real implementation is expected to set fields such as
 * `adjustment_notes` / `jabatan_adjusted` / `pph21_forced_to_ter` on `emp`.
 *
 * @param emp  Employee row (mutated in place).
 * @param ctx  Period context { month, year, divisionCode }.
 */
export function attachPayrollPeriodAdjustmentNotes(
    emp: any,
    ctx: PayrollPeriodContext
): void {
    // no-op stub
}
