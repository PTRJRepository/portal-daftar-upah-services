export function resolveEffectiveGangPrefix(gangCode, gangPrefix) {
    if (gangCode && gangCode !== 'ALL') {
        return null;
    }

    return gangPrefix || null;
}

export function buildPayrollRequestScopeKey({
    division,
    month,
    year,
    gangCode,
    gangPrefix,
    useHistoryDb,
    snapshotVersion
}) {
    return JSON.stringify({
        division: division || null,
        month: month || null,
        year: year || null,
        gangCode: gangCode || null,
        gangPrefix: resolveEffectiveGangPrefix(gangCode, gangPrefix),
        useHistoryDb: Boolean(useHistoryDb),
        snapshotVersion: snapshotVersion ?? null
    });
}
