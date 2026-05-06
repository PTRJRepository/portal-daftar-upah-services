type ComponentMetadata = Record<string, unknown>;

function toNumber(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function normalizePremiumLookupKey(value: string): string {
    return String(value || "")
        .trim()
        .replace(/\s+/g, "_")
        .toLowerCase();
}

function shouldSkipPremiumKey(value: string): boolean {
    const upper = String(value || "").toUpperCase();
    return upper.includes("PPH") || upper.includes("KOREKSI") || upper.includes("ADJ");
}

function resolvePremiumValue(emp: Record<string, any>, rawKey: string): number {
    const key = String(rawKey || "").trim();
    if (!key) return 0;

    const normalized = normalizePremiumLookupKey(key);
    const stripped = normalized.replace(/^premi_/, "");
    const candidates = [
        key,
        key.toUpperCase().replace(/ /g, "_"),
        normalized,
        stripped,
        `premi_${stripped}`
    ];

    for (const candidate of candidates) {
        if (emp[candidate] !== undefined) {
            const value = toNumber(emp[candidate]);
            if (value !== 0) return value;
        }
    }

    const premi = emp.premi;
    if (premi && typeof premi === "object" && !Array.isArray(premi)) {
        for (const candidate of candidates) {
            if (premi[candidate] !== undefined) {
                const value = toNumber(premi[candidate]);
                if (value !== 0) return value;
            }
        }
    }

    if (stripped === "brondol") {
        return toNumber(emp.premi_brondol_total) || toNumber(emp.premi_brondol);
    }

    return 0;
}

function buildDomPremiumDetail(emp: Record<string, any>, premiKeys: string[]): Record<string, number> {
    const detail: Record<string, number> = {};

    if (emp.premi_detail && typeof emp.premi_detail === "object" && !Array.isArray(emp.premi_detail)) {
        for (const [key, value] of Object.entries(emp.premi_detail)) {
            if (shouldSkipPremiumKey(key)) continue;
            const numeric = toNumber(value);
            if (numeric !== 0) detail[key] = numeric;
        }
    }

    for (const key of premiKeys) {
        if (!key || shouldSkipPremiumKey(key)) continue;
        const value = resolvePremiumValue(emp, key);
        if (value !== 0) detail[key] = value;
    }

    const brondolValue = toNumber(emp.premi_brondol_total) || toNumber(emp.premi_brondol);
    if (brondolValue !== 0 && !Object.keys(detail).some((key) => normalizePremiumLookupKey(key) === "premi_brondol" || normalizePremiumLookupKey(key) === "brondol")) {
        detail.BRONDOL = brondolValue;
    }

    return detail;
}

export function prepareDomTaxExcelRows(
    employees: Array<Record<string, any>>,
    premiKeys: string[] = [],
    componentMetadata: ComponentMetadata = {}
): { employees: Array<Record<string, any>>; totalPph21: number } {
    let totalPph21 = 0;
    const preparedEmployees = (Array.isArray(employees) ? employees : []).map((emp) => {
        const next = {
            ...emp,
            component_metadata: componentMetadata
        };

        const premiumDetail = buildDomPremiumDetail(next, Array.isArray(premiKeys) ? premiKeys : []);
        if (Object.keys(premiumDetail).length > 0) {
            next.premi_detail = premiumDetail;
        }

        if (!next.pot_alpa_cth && !next.pot_alpa) {
            const ideal = toNumber(next.gaji_pokok_ideal);
            const actual = toNumber(next.gaji_pokok_aktual);
            if (ideal > 0 && actual > 0 && ideal > actual) {
                next.pot_alpa_cth = -(ideal - actual);
            }
        }

        totalPph21 += toNumber(next.pph21_ter) || toNumber(next.potongan_pph21) || toNumber(next.pot_pph21);
        return next;
    });

    return { employees: preparedEmployees, totalPph21 };
}
