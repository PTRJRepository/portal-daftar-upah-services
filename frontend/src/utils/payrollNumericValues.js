export function toFinitePayrollNumber(value) {
  if (value === null || value === undefined || value === "") return 0;

  const normalized =
    typeof value === "string" ? value.trim().replace(/,/g, "") : value;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function parsePayrollInputNumber(value) {
  if (value === null || value === undefined) return 0;
  if (value === "") return 0;

  const normalized =
    typeof value === "string" ? value.trim().replace(/,/g, "") : value;

  if (normalized === "") return 0;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolvePersistentOriginalNumber(previousOriginal, fallbackOriginal) {
  if (previousOriginal !== null && previousOriginal !== undefined) {
    return toFinitePayrollNumber(previousOriginal);
  }
  return toFinitePayrollNumber(fallbackOriginal);
}
