type AdjustmentType = 'PREMI' | 'POTONGAN_KOTOR' | 'POTONGAN_BERSIH';

const PREFIX_BY_TYPE: Record<AdjustmentType, RegExp> = {
    PREMI: /^PREMI\s+/i,
    POTONGAN_KOTOR: /^KOREKSI\s+/i,
    POTONGAN_BERSIH: /^POTONGAN\s+LAINNYA\s+/i
};

const FIELD_PREFIX_BY_TYPE: Record<AdjustmentType, string> = {
    PREMI: 'premi',
    POTONGAN_KOTOR: 'koreksi',
    POTONGAN_BERSIH: 'potongan_lainnya'
};

export function normalizeStoredAdjustmentName(name: string): string {
    return String(name || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
}

export function toManualAdjustmentFieldName(
    adjustmentType: AdjustmentType,
    adjustmentName: string
): string {
    const normalizedName = normalizeStoredAdjustmentName(adjustmentName);
    const suffix = normalizedName
        .replace(PREFIX_BY_TYPE[adjustmentType], '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    return `${FIELD_PREFIX_BY_TYPE[adjustmentType]}_${suffix}`;
}

export function shouldDeleteStoredAdjustment(amount: number, remarks?: string | null): boolean {
    const text = String(remarks || '');
    return Number(amount || 0) === 0 && !text.includes('INIT_COLUMN') && !text.includes('sync:');
}
