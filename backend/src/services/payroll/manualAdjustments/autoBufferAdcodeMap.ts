export const AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME = {
    "AUTO TUNJANGAN JABATAN": "tunjangan jabatan",
    "AUTO MASA KERJA": "masa kerja",
    "AUTO SPSI": "potongan spsi"
} as const;

export type AutoBufferAdjustmentName = keyof typeof AUTO_BUFFER_ADCODE_BY_ADJUSTMENT_NAME;

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

export function buildAutoBufferSeedRemark(adjustmentName: unknown, amount: unknown): string {
    const normalizedName = normalizeAdjustmentName(adjustmentName);
    const adcode = resolveAutoBufferAdcode(normalizedName);
    const numericAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
    return `${normalizedName} | ${adcode} | ${numericAmount}`;
}
