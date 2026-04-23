import { describe, expect, it } from 'bun:test';
import { applyManualAdjustmentsToEmployee } from './manualAdjustmentApplier';

describe('applyManualAdjustmentsToEmployee', () => {
    it('maps normalized manual adjustments into fields and deltas', () => {
        const result = applyManualAdjustmentsToEmployee({
            adjustments: [
                { adjustment_type: 'PREMI', adjustment_name: 'PREMI INSENTIF', amount: 25000 },
                { adjustment_type: 'POTONGAN_KOTOR', adjustment_name: 'KOREKSI DENDA PANEN', amount: 10000 },
                { adjustment_type: 'POTONGAN_BERSIH', adjustment_name: 'POTONGAN LAINNYA KASBON', amount: 5000 }
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
    });
});
