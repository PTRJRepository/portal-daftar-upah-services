export interface MasaKerjaDisplay {
    years: number;
    months: number;
    label: string;
}

function parseValidPayrollDate(value: string | null | undefined): Date | null {
    const normalized = normalizeEffectiveStartDate(value);
    if (!normalized) return null;

    const parsed = new Date(`${normalized}T00:00:00`);
    if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() > 1905) {
        return parsed;
    }

    const fallbackParsed = new Date(normalized);
    if (!Number.isNaN(fallbackParsed.getTime()) && fallbackParsed.getFullYear() > 1905) {
        return fallbackParsed;
    }

    return null;
}

function formatPayrollDate(date: Date): string {
    return date.toISOString().split("T")[0];
}

export function deriveInitialSpsiMember(potSpsi: number | null | undefined): boolean {
    return Number(potSpsi || 0) > 0;
}

export function normalizeEffectiveStartDate(value: string | null | undefined): string | null {
    const trimmed = String(value || "").trim();
    return trimmed || null;
}

export function resolveThrCompatibleEffectiveStartDate(
    appJoinDate: string | null | undefined,
    appJoinGrpDate: string | null | undefined,
    fallbackDate?: string | null
): string | null {
    const date1 = parseValidPayrollDate(appJoinDate);
    const date2 = parseValidPayrollDate(appJoinGrpDate);
    const fallback = parseValidPayrollDate(fallbackDate);

    if (date1 && date2) {
        return formatPayrollDate(date1.getTime() > date2.getTime() ? date1 : date2);
    }

    if (date1 || date2) {
        return formatPayrollDate((date1 || date2)!);
    }

    return fallback ? formatPayrollDate(fallback) : null;
}

export function calculateMasaKerjaDisplay(
    startDate: string | null | undefined,
    month: number,
    year: number
): MasaKerjaDisplay {
    const normalizedStartDate = normalizeEffectiveStartDate(startDate);
    if (!normalizedStartDate) {
        return {
            years: 0,
            months: 0,
            label: "0 bln"
        };
    }

    const start = new Date(`${normalizedStartDate}T00:00:00`);
    if (Number.isNaN(start.getTime())) {
        return {
            years: 0,
            months: 0,
            label: "0 bln"
        };
    }

    const period = new Date(year, month - 1, 1);
    const totalMonths = Math.max(
        0,
        (period.getFullYear() - start.getFullYear()) * 12 + (period.getMonth() - start.getMonth())
    );
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;

    return {
        years,
        months,
        label: years > 0 ? `${years} thn ${months} bln` : `${months} bln`
    };
}
