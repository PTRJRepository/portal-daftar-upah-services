import { toManualAdjustmentFieldName } from './manualAdjustmentNaming';

export type ManualAdjustmentType = 'PREMI' | 'POTONGAN_KOTOR' | 'POTONGAN_BERSIH';

export interface ManualAdjustmentLike {
    adjustment_type: ManualAdjustmentType;
    adjustment_name: string;
    amount: number;
}

export interface ManualAdjustmentApplierInput {
    adjustments: ManualAdjustmentLike[];
    empPremi: Record<string, number>;
    empPotongan: Record<string, number>;
    premiTitleMap: Record<string, string>;
    potonganTitleMap: Record<string, string>;
}

export interface ManualAdjustmentApplierResult {
    empPremi: Record<string, number>;
    empPotongan: Record<string, number>;
    premiTitleMap: Record<string, string>;
    potonganTitleMap: Record<string, string>;
    koreksiVariations: Record<string, number>;
    totalPremiDelta: number;
    potKoreksiDelta: number;
    otherPotonganDelta: number;
}

function toAmount(value: number): number {
    return Number(value) || 0;
}

export function applyManualAdjustmentsToEmployee(input: ManualAdjustmentApplierInput): ManualAdjustmentApplierResult {
    const koreksiVariations: Record<string, number> = {};
    let totalPremiDelta = 0;
    let potKoreksiDelta = 0;
    let otherPotonganDelta = 0;

    for (const adjustment of input.adjustments || []) {
        const amount = toAmount(adjustment.amount);
        const name = String(adjustment.adjustment_name || '');

        if (adjustment.adjustment_type === 'PREMI') {
            const fieldName = toManualAdjustmentFieldName('PREMI', name);
            input.empPremi[fieldName] = (input.empPremi[fieldName] || 0) + amount;
            input.premiTitleMap[fieldName] = name;
            totalPremiDelta += amount;
            continue;
        }

        if (adjustment.adjustment_type === 'POTONGAN_KOTOR') {
            const fieldName = toManualAdjustmentFieldName('POTONGAN_KOTOR', name);
            input.empPotongan[fieldName] = (input.empPotongan[fieldName] || 0) + amount;
            koreksiVariations[fieldName] = (koreksiVariations[fieldName] || 0) + amount;
            input.potonganTitleMap[fieldName] = name;
            potKoreksiDelta += amount;
            continue;
        }

        if (adjustment.adjustment_type === 'POTONGAN_BERSIH') {
            const fieldName = toManualAdjustmentFieldName('POTONGAN_BERSIH', name);
            input.empPotongan[fieldName] = (input.empPotongan[fieldName] || 0) + amount;
            input.potonganTitleMap[fieldName] = name;
            otherPotonganDelta += amount;
        }
    }

    return {
        empPremi: input.empPremi,
        empPotongan: input.empPotongan,
        premiTitleMap: input.premiTitleMap,
        potonganTitleMap: input.potonganTitleMap,
        koreksiVariations,
        totalPremiDelta,
        potKoreksiDelta,
        otherPotonganDelta
    };
}
