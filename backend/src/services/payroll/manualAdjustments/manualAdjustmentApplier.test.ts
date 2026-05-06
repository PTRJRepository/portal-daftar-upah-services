import { describe, expect, it } from 'bun:test';
import { applyManualAdjustmentsToEmployee } from './manualAdjustmentApplier';

describe('applyManualAdjustmentsToEmployee', () => {
    it('maps normalized manual adjustments into fields and deltas', () => {
        const result = applyManualAdjustmentsToEmployee({
            adjustments: [
                { adjustment_type: 'PREMI', adjustment_name: 'PREMI INSENTIF', amount: 25000 },
                { adjustment_type: 'POTONGAN_KOTOR', adjustment_name: 'KOREKSI DENDA PANEN', amount: 10000 },
                { adjustment_type: 'POTONGAN_BERSIH', adjustment_name: 'POTONGAN LAINNYA KASBON', amount: 5000 },
                { adjustment_type: 'PENDAPATAN_LAINNYA', adjustment_name: 'KONTAN', amount: 9999 }
            ],
            empPremi: {},
            empPotongan: {},
            premiTitleMap: {},
            potonganTitleMap: {}
        });

        expect(result.empPremi.premi_insentif).toBe(25000);
        expect(result.koreksiVariations.koreksi_denda_panen).toBe(10000);
        expect(result.empPotongan.potongan_lainnya_kasbon).toBe(5000);
        expect(result.totalPremiDelta).toBe(25000);
        expect(result.potKoreksiDelta).toBe(10000);
        expect(result.otherPotonganDelta).toBe(5000);
        expect(result.premiTitleMap.premi_insentif).toBe('PREMI INSENTIF');
        expect(result.potonganTitleMap.koreksi_denda_panen).toBe('KOREKSI DENDA PANEN');
        expect(result.potonganTitleMap.potongan_lainnya_kasbon).toBe('POTONGAN LAINNYA KASBON');
        expect(result.potonganTitleMap.kontan).toBeUndefined();
        expect(result.empPotongan.kontan).toBeUndefined();
    });

    it('supports override mode so manual values replace db baseline per field', () => {
        const result = applyManualAdjustmentsToEmployee({
            adjustments: [
                { adjustment_type: 'PREMI', adjustment_name: 'PREMI INSENTIF', amount: 25000 },
                { adjustment_type: 'POTONGAN_KOTOR', adjustment_name: 'KOREKSI DENDA PANEN', amount: 10000 },
                { adjustment_type: 'POTONGAN_BERSIH', adjustment_name: 'POTONGAN LAINNYA KASBON', amount: 5000 }
            ],
            empPremi: { premi_insentif: 12000 },
            empPotongan: { KOREKSI_DENDA_PANEN: 7000, potongan_lainnya_kasbon: 2000 },
            premiTitleMap: {},
            potonganTitleMap: {},
            mode: 'override'
        });

        expect(result.empPremi.premi_insentif).toBe(25000);
        expect(result.empPotongan.KOREKSI_DENDA_PANEN).toBe(10000);
        expect(result.empPotongan.potongan_lainnya_kasbon).toBe(5000);
        expect(result.totalPremiDelta).toBe(13000);
        expect(result.potKoreksiDelta).toBe(3000);
        expect(result.otherPotonganDelta).toBe(3000);
        expect(result.fieldSyncMeta.length).toBe(3);
        expect(result.fieldSyncMeta.find((x) => x.fieldName === 'premi_insentif')?.hadDbValue).toBe(true);
        expect(result.fieldSyncMeta.find((x) => x.fieldName === 'KOREKSI_DENDA_PANEN')?.previousAmount).toBe(7000);
    });

    it('materializes legacy manual premium field names into report premium fields', () => {
        const result = applyManualAdjustmentsToEmployee({
            adjustments: [
                { adjustment_type: 'PREMI', adjustment_name: 'premi_pruning', amount: 125000 }
            ],
            empPremi: {},
            empPotongan: {},
            premiTitleMap: {},
            potonganTitleMap: {},
            mode: 'override'
        });

        expect(result.empPremi.premi_pruning).toBe(125000);
        expect(result.empPremi.premi_premi_pruning).toBeUndefined();
        expect(result.totalPremiDelta).toBe(125000);
        expect(result.fieldSyncMeta[0]).toMatchObject({
            fieldName: 'premi_pruning',
            finalAmount: 125000
        });
    });

    it('normalizes negative koreksi and potongan amounts to positive calculation values', () => {
        const result = applyManualAdjustmentsToEmployee({
            adjustments: [
                { adjustment_type: 'POTONGAN_KOTOR', adjustment_name: 'KOREKSI DENDA PANEN', amount: -10000 },
                { adjustment_type: 'POTONGAN_KOTOR', adjustment_name: 'KOREKSI DENDA PANEN', amount: -5000 },
                {
                    adjustment_type: 'POTONGAN_BERSIH',
                    adjustment_name: 'POTONGAN LAINNYA KASBON',
                    amount: 0,
                    metadata_json: JSON.stringify({ input_type: 'exp', jumlah: -7000, total_amount: -7000 })
                }
            ],
            empPremi: {},
            empPotongan: {},
            premiTitleMap: {},
            potonganTitleMap: {}
        });

        expect(result.koreksiVariations.koreksi_denda_panen).toBe(15000);
        expect(result.empPotongan.koreksi_denda_panen).toBe(15000);
        expect(result.empPotongan.potongan_lainnya_kasbon).toBe(7000);
        expect(result.potKoreksiDelta).toBe(15000);
        expect(result.otherPotonganDelta).toBe(7000);
    });

    it('compares override potongan values by positive magnitude when db baseline is negative', () => {
        const result = applyManualAdjustmentsToEmployee({
            adjustments: [
                { adjustment_type: 'POTONGAN_KOTOR', adjustment_name: 'KOREKSI DENDA PANEN', amount: -7000 },
                { adjustment_type: 'POTONGAN_BERSIH', adjustment_name: 'POTONGAN LAINNYA KASBON', amount: -4000 }
            ],
            empPremi: {},
            empPotongan: { koreksi_denda_panen: -7000, potongan_lainnya_kasbon: -3000 },
            premiTitleMap: {},
            potonganTitleMap: {},
            mode: 'override'
        });

        expect(result.empPotongan.koreksi_denda_panen).toBe(7000);
        expect(result.empPotongan.potongan_lainnya_kasbon).toBe(4000);
        expect(result.potKoreksiDelta).toBe(0);
        expect(result.otherPotonganDelta).toBe(1000);
        expect(result.fieldSyncMeta.find((x) => x.fieldName === 'koreksi_denda_panen')?.previousAmount).toBe(7000);
    });
});
