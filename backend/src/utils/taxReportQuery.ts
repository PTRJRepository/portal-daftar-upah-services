import { parseBooleanQueryParam } from "./queryParsers";

export interface MonthlyTaxQueryInput {
    year?: string;
    month?: string;
    division?: string;
    gang?: string;
    gangPrefix?: string;
    use_history?: string;
}

export interface MonthlyTaxUserScope {
    role?: string | null;
    divisions?: string[] | null;
}

export interface ResolvedMonthlyTaxQuery {
    year: number;
    month: number;
    division?: string;
    gang?: string;
    gangPrefix?: string;
    useHistoryDb: boolean;
    hasValidPeriod: boolean;
}

function normalizeOptionalString(value?: string): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveMonthlyTaxQuery(
    query: MonthlyTaxQueryInput,
    currentUser?: MonthlyTaxUserScope | null
): ResolvedMonthlyTaxQuery {
    const year = Number.parseInt(query.year ?? "", 10);
    const month = Number.parseInt(query.month ?? "", 10);

    let division = normalizeOptionalString(query.division);
    const gang = normalizeOptionalString(query.gang);
    const gangPrefix = normalizeOptionalString(query.gangPrefix);

    if (currentUser?.role?.toLowerCase() === "kerani" && currentUser.divisions && currentUser.divisions.length > 0) {
        division = normalizeOptionalString(currentUser.divisions[0]);
    }

    return {
        year,
        month,
        division,
        gang,
        gangPrefix,
        useHistoryDb: parseBooleanQueryParam(query.use_history) ?? false,
        hasValidPeriod: Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12
    };
}
