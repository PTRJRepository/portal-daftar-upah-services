export const AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME = {
    "AUTO TUNJANGAN JABATAN": "tunjangan jabatan",
    "AUTO MASA KERJA": "masa kerja",
    "AUTO SPSI": "potongan spsi"
} as const;

export type AutoBufferAdjustmentName = keyof typeof AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME;
export type AutoBufferSyncStatus = "SYNC" | "MISS";
export type AutoBufferMatchStatus = "MATCH" | "MISMATCH";

function normalizeAdjustmentName(value: unknown): string {
    return String(value || "").trim().toUpperCase();
}

export function resolveAutoBufferAdcode(adjustmentName: unknown): string {
    const normalizedName = normalizeAdjustmentName(adjustmentName);
    const adcode = AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME[normalizedName as AutoBufferAdjustmentName];

    if (!adcode) {
        throw new Error(`Auto buffer adcode belum dikonfigurasi untuk adjustment_name: ${normalizedName}`);
    }

    return adcode;
}

function resolveSyncAndMatchStatus(
    seededAmount: number,
    sourceAmount: number
): { sync: AutoBufferSyncStatus; match: AutoBufferMatchStatus } {
    const isMatch = Math.abs(seededAmount - sourceAmount) <= 0.01;
    return {
        sync: isMatch ? "SYNC" : "MISS",
        match: isMatch ? "MATCH" : "MISMATCH"
    };
}

export function buildAutoBufferSeedRemark(
    adjustmentName: unknown,
    amount: unknown,
    sourceAmount?: unknown
): string {
    const normalizedName = normalizeAdjustmentName(adjustmentName);
    const adcode = resolveAutoBufferAdcode(normalizedName);
    const numericAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
    const numericSourceAmount = Number.isFinite(Number(sourceAmount))
        ? Number(sourceAmount)
        : numericAmount;
    const status = resolveSyncAndMatchStatus(numericAmount, numericSourceAmount);
    return `${normalizedName} | ${adcode} | ${numericAmount} | sync:${status.sync} | match:${status.match}`;
}
