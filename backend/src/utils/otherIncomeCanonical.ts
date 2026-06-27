/**
 * otherIncomeCanonical.ts
 *
 * Canonicalization helpers for "other income" (pendapatan lainnya) types.
 *
 * STATUS: STUB — this module was imported across multiple services
 * (taxReportService, reportService, daftarUpahExcelService, taxReportExcelService,
 * otherIncomesService, taxReportRoutes, taxDomExportRows) but was never committed
 * to git. This stub provides functional-enough implementations so the backend
 * boots and tax/other-income flows do not crash. The canonical-type mapping is
 * intentionally simple (uppercase + alias collapse) and may need refinement to
 * match the real business normalization rules.
 *
 * TODO: Replace with the real canonicalization logic once available.
 */

export type CanonicalOtherIncomeType = "THR" | "BONUS" | "KONTAN" | "EXGRATIA" | string;

/**
 * Normalize a raw other-income key/label into the canonical type token.
 * Used by Excel export to collapse `pendapatan_thr` / `THR` / `thr` etc. onto "THR".
 */
export function normalizeOtherIncomeType(
    input: OtherIncomeLike | null | undefined
): CanonicalOtherIncomeType {
    return getCanonicalOtherIncomeType(input);
}

/**
 * Format a canonical other-income type as a human-readable label.
 * Used as the Excel column header / display label for the income type.
 */
export function formatCanonicalOtherIncomeLabel(
    input: OtherIncomeLike | null | undefined
): string {
    const canonical = String(getCanonicalOtherIncomeType(input)).toUpperCase();
    if (!canonical) return "Lainnya";
    const pretty: Record<string, string> = {
        THR: "THR",
        BONUS: "Bonus",
        KONTAN: "Kontan",
        EXGRATIA: "Exgratia",
    };
    return pretty[canonical] ?? canonical;
}

/**
 * Input shapes accepted across call sites:
 *   - string                              (raw type label)
 *   - { type: string }                    (income-like object)
 *   - { income_type?: string; type?: string; ... } (DB row / OtherIncome)
 */
type OtherIncomeLike =
    | string
    | { type?: string; income_type?: string; Type?: string; IncomeType?: string };

function rawTypeOf(input: OtherIncomeLike | null | undefined): string {
    if (input == null) return "";
    if (typeof input === "string") return input;
    return (
        input.type ??
        input.income_type ??
        input.Type ??
        input.IncomeType ??
        ""
    );
}

/**
 * Normalize a raw other-income type label to its canonical form.
 * Collapses common aliases (case-insensitive) onto the canonical set
 * { THR, BONUS, KONTAN, EXGRATIA }. Unknown labels are returned uppercased
 * so callers can still group by them without losing data.
 */
export function getCanonicalOtherIncomeType(
    input: OtherIncomeLike | null | undefined
): CanonicalOtherIncomeType {
    const raw = rawTypeOf(input).trim().toUpperCase();
    if (!raw) return "";

    // Strip common prefixes (e.g. "pendapatan_thr" -> "THR")
    const stripped = raw.replace(/^PENDAPATAN_/, "").replace(/^OTHER_/, "");

    if (stripped === "THR" || stripped.includes("THR")) return "THR";
    if (stripped === "BONUS" || stripped.includes("BONUS")) return "BONUS";
    if (stripped === "KONTAN" || stripped.includes("KONTAN")) return "KONTAN";
    if (stripped === "EXGRATIA" || stripped.includes("EXGRATIA")) return "EXGRATIA";

    return stripped;
}

/**
 * Resolve the canonical type for persistence (alias of getCanonicalOtherIncomeType
 * with a null-safe return). Some call sites expect a possibly-null result when the
 * input carries no recognizable type.
 */
export function resolveCanonicalOtherIncomeType(
    input: OtherIncomeLike | null | undefined
): CanonicalOtherIncomeType | null {
    const canonical = getCanonicalOtherIncomeType(input);
    return canonical === "" ? null : canonical;
}

/**
 * Sum the amount of other-income items matching a canonical type.
 *
 * @param items  Array of other-income rows. Each row may expose its amount under
 *               `jumlah`, `amount`, `total_amount`, or `value`, and its type under
 *               `type` / `income_type`.
 * @param canonicalType  Canonical type to match (e.g. "THR"). If omitted, sums all.
 * @returns Sum of matching amounts (0 when none / empty).
 */
export function sumOtherIncomeByCanonicalType(
    items: any[] | null | undefined,
    canonicalType?: CanonicalOtherIncomeType
): number {
    if (!items || !Array.isArray(items) || items.length === 0) return 0;

    const target = canonicalType ? String(canonicalType).toUpperCase() : null;

    let total = 0;
    for (const item of items) {
        if (!item) continue;
        if (target !== null) {
            const itemCanonical = String(getCanonicalOtherIncomeType(item)).toUpperCase();
            if (itemCanonical !== target) continue;
        }
        const amount =
            Number(item.jumlah ?? item.amount ?? item.total_amount ?? item.value ?? 0) || 0;
        total += amount;
    }
    return total;
}
