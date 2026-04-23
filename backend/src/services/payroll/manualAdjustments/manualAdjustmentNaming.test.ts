import { describe, expect, it } from 'bun:test';
import {
    normalizeStoredAdjustmentName,
    shouldDeleteStoredAdjustment,
    toManualAdjustmentFieldName
} from './manualAdjustmentNaming';

describe('manualAdjustmentNaming', () => {
    it('normalizes stored names and field names without duplicate prefixes', () => {
        expect(normalizeStoredAdjustmentName(' PREMI   INSENTIF ')).toBe('PREMI INSENTIF');
        expect(toManualAdjustmentFieldName('PREMI', 'PREMI INSENTIF')).toBe('premi_insentif');
        expect(toManualAdjustmentFieldName('POTONGAN_KOTOR', 'KOREKSI DENDA PANEN')).toBe('koreksi_denda_panen');
        expect(toManualAdjustmentFieldName('POTONGAN_BERSIH', 'POTONGAN LAINNYA KASBON')).toBe('potongan_lainnya_kasbon');
    });

    it('retains zero-value placeholder rows with INIT_COLUMN remarks', () => {
        expect(shouldDeleteStoredAdjustment(0, 'INIT_COLUMN ...')).toBe(false);
        expect(shouldDeleteStoredAdjustment(0, 'Edited via UI')).toBe(true);
    });
});
