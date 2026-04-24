import { describe, expect, it } from 'vitest';
import {
  isPayrollNumericField,
  resolveGrandTotalNumericValue,
  resolveGrandTotalSourceField,
} from './payrollGrandTotalValue';

describe('resolveGrandTotalSourceField', () => {
  it('maps deduction suffix field to the source income field', () => {
    expect(resolveGrandTotalSourceField('pendapatan_thr_pengurang')).toBe('pendapatan_thr');
    expect(resolveGrandTotalSourceField('total_pendapatan_lainnya_pengurang')).toBe('total_pendapatan_lainnya');
  });
});

describe('resolveGrandTotalNumericValue', () => {
  it('uses alias field from grand total when direct key is missing', () => {
    const value = resolveGrandTotalNumericValue({
      grandTotal: { pendapatan_thr: 135000 },
      rows: [],
      field: 'pendapatan_thr_pengurang',
    });

    expect(value).toBe(135000);
  });

  it('falls back to summing only employee rows when grand total does not provide the key', () => {
    const value = resolveGrandTotalNumericValue({
      grandTotal: {},
      rows: [
        { type: 'employee', premi_insentif: 1000 },
        { type: 'employee', premi_insentif: 2500 },
        { type: 'gang_total', premi_insentif: 999999 },
      ],
      field: 'premi_insentif',
    });

    expect(value).toBe(3500);
  });
});

describe('isPayrollNumericField', () => {
  it('detects known numeric payroll patterns', () => {
    expect(isPayrollNumericField('pendapatan_thr_pengurang')).toBe(true);
    expect(isPayrollNumericField('taxable_pendapatan_lainnya')).toBe(true);
    expect(isPayrollNumericField('nama')).toBe(false);
  });
});
