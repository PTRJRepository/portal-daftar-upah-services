import { describe, expect, it } from 'bun:test';
import {
    normalizeManualAdjustmentDivisionCode,
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

    it('normalizes mixed-case and already canonical inputs for backward-compatible matching', () => {
        expect(normalizeStoredAdjustmentName('premi    insentif')).toBe('PREMI INSENTIF');
        expect(normalizeStoredAdjustmentName('  KOREKSI   DENDA   PANEN  ')).toBe('KOREKSI DENDA PANEN');
        expect(normalizeStoredAdjustmentName('POTONGAN LAINNYA KASBON')).toBe('POTONGAN LAINNYA KASBON');
        expect(toManualAdjustmentFieldName('PREMI', 'premi    insentif')).toBe('premi_insentif');
    });

    it('retains zero-value placeholder rows with INIT_COLUMN or sync remarks', () => {
        expect(shouldDeleteStoredAdjustment(0, 'INIT_COLUMN ...')).toBe(false);
        expect(shouldDeleteStoredAdjustment(0, 'KOREKSI DENDA | DE0004 - (DE) POTONGAN PREMI | 0 | sync:MISS | match:MISMATCH')).toBe(false);
        expect(shouldDeleteStoredAdjustment(0, 'Edited via UI')).toBe(true);
    });

    it('normalizes stored division codes to the 3-character payroll format', () => {
        expect(normalizeManualAdjustmentDivisionCode('PG1A')).toBe('P1A');
        expect(normalizeManualAdjustmentDivisionCode('PG1B')).toBe('P1B');
        expect(normalizeManualAdjustmentDivisionCode('PG2A')).toBe('P2A');
        expect(normalizeManualAdjustmentDivisionCode('PG2B')).toBe('P2B');
        expect(normalizeManualAdjustmentDivisionCode('ARB1')).toBe('AB1');
        expect(normalizeManualAdjustmentDivisionCode('ARB2')).toBe('AB2');
        expect(normalizeManualAdjustmentDivisionCode('INFRA')).toBe('INF');
        expect(normalizeManualAdjustmentDivisionCode('AREC')).toBe('ARC');
        expect(normalizeManualAdjustmentDivisionCode('WKS_AR')).toBe('WKS_AR');
        expect(normalizeManualAdjustmentDivisionCode('WKS_PG')).toBe('WKS_PG');
    });
});
