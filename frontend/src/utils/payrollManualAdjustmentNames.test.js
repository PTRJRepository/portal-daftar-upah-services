import { describe, expect, it } from 'vitest';
import {
  buildCanonicalManualAdjustmentName,
  buildPendingManualColumn,
} from './payrollManualAdjustmentNames';

describe('payrollManualAdjustmentNames', () => {
  it('builds canonical prefixed names for each supported group', () => {
    expect(buildCanonicalManualAdjustmentName('PREMI', 'Insentif')).toBe('PREMI INSENTIF');
    expect(buildCanonicalManualAdjustmentName('POTONGAN UPAH KOTOR', 'Denda Panen')).toBe('KOREKSI DENDA PANEN');
    expect(buildCanonicalManualAdjustmentName('POTONGAN UPAH BERSIH', 'Kasbon')).toBe('POTONGAN LAINNYA KASBON');
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
});
