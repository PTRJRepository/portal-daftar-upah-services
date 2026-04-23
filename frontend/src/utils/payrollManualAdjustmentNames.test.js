import { describe, expect, it } from 'vitest';
import {
  buildCanonicalManualAdjustmentName,
  buildPendingManualColumn,
  sanitizeManualAdjustmentLabel,
} from './payrollManualAdjustmentNames';

describe('payrollManualAdjustmentNames', () => {
  it('builds canonical prefixed names for each supported group', () => {
    expect(buildCanonicalManualAdjustmentName('PREMI', 'Insentif')).toBe('PREMI INSENTIF');
    expect(buildCanonicalManualAdjustmentName('POTONGAN UPAH KOTOR', 'Denda Panen')).toBe('KOREKSI DENDA PANEN');
    expect(buildCanonicalManualAdjustmentName('POTONGAN UPAH BERSIH', 'Kasbon')).toBe('POTONGAN LAINNYA KASBON');
  });

  it('keeps canonical names idempotent when user input already has prefix', () => {
    expect(buildCanonicalManualAdjustmentName('PREMI', 'PREMI INSENTIF')).toBe('PREMI INSENTIF');
    expect(buildCanonicalManualAdjustmentName('POTONGAN UPAH KOTOR', 'KOREKSI DENDA')).toBe('KOREKSI DENDA');
    expect(buildCanonicalManualAdjustmentName('POTONGAN UPAH BERSIH', 'POTONGAN LAINNYA KASBON')).toBe('POTONGAN LAINNYA KASBON');
  });

  it('builds optimistic pending column metadata with field and scope', () => {
    expect(
      buildPendingManualColumn({
        groupLabel: 'PREMI',
        rawName: 'Insentif',
        division: 'AB1',
        firstEmployee: { nik: '3171', emp_code: 'B0001', gang_code: 'A1' },
      }),
    ).toEqual({
      fieldName: 'premi_insentif',
      adjustmentType: 'PREMI',
      adjustmentName: 'PREMI INSENTIF',
      activeFieldBucket: 'premi',
      payload: {
        nik: '3171',
        emp_code: 'B0001',
        gang_code: 'A1',
        division_code: 'AB1',
        type: 'PREMI',
        name: 'PREMI INSENTIF',
      },
    });
  });

  it('falls back emp_code to nik while requiring nik and gang_code identities', () => {
    expect(
      buildPendingManualColumn({
        groupLabel: 'PREMI',
        rawName: 'Insentif',
        division: 'AB1',
        firstEmployee: { nik: '3171', gang_code: 'A1' },
      }),
    ).toEqual({
      fieldName: 'premi_insentif',
      adjustmentType: 'PREMI',
      adjustmentName: 'PREMI INSENTIF',
      activeFieldBucket: 'premi',
      payload: {
        nik: '3171',
        emp_code: '3171',
        gang_code: 'A1',
        division_code: 'AB1',
        type: 'PREMI',
        name: 'PREMI INSENTIF',
      },
    });

    expect(
      buildPendingManualColumn({
        groupLabel: 'PREMI',
        rawName: 'Insentif',
        division: 'AB1',
        firstEmployee: { nik: '', gang_code: 'A1' },
      }),
    ).toBeNull();

    expect(
      buildPendingManualColumn({
        groupLabel: 'PREMI',
        rawName: 'Insentif',
        division: 'AB1',
        firstEmployee: { nik: '3171', gang_code: '' },
      }),
    ).toBeNull();
  });

  it('returns safe empty/null outputs for unsupported group labels', () => {
    expect(buildCanonicalManualAdjustmentName('UNKNOWN', 'Kasbon')).toBe('');
    expect(
      buildPendingManualColumn({
        groupLabel: 'UNKNOWN',
        rawName: 'Kasbon',
        division: 'AB1',
        firstEmployee: { nik: '3171', gang_code: 'A1' },
      }),
    ).toBeNull();
  });

  it('sanitizes symbols and repeated spaces consistently', () => {
    expect(sanitizeManualAdjustmentLabel('  @@Insentif###   Panen!!  ')).toBe('Insentif Panen');
    expect(buildCanonicalManualAdjustmentName('PREMI', '  ##Insentif   Panen!!  ')).toBe('PREMI INSENTIF PANEN');
  });
});
