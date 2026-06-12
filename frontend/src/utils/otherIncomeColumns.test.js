import { describe, expect, it } from 'vitest';
import {
  formatOtherIncomeColumnLabel,
  getOtherIncomeDetailFields,
} from './otherIncomeColumns';

describe('getOtherIncomeDetailFields', () => {
  it('removes total field and appends kontan detail for deduction breakdown', () => {
    expect(
      getOtherIncomeDetailFields(
        ['pendapatan_thr', 'pendapatan_bonus', 'pendapatan_lainnya'],
        { includeKontan: true },
      ),
    ).toEqual([
      'pendapatan_thr',
      'pendapatan_bonus',
      'pendapatan_kontan',
    ]);
  });

  it('does not duplicate kontan when already present', () => {
    expect(
      getOtherIncomeDetailFields(
        ['pendapatan_thr', 'pendapatan_kontan', 'pendapatan_lainnya'],
        { includeKontan: true },
      ),
    ).toEqual([
      'pendapatan_thr',
      'pendapatan_kontan',
    ]);
  });
});

describe('formatOtherIncomeColumnLabel', () => {
  it('builds readable uppercase labels with suffixes', () => {
    expect(formatOtherIncomeColumnLabel('pendapatan_thr', '(-)')).toBe('THR (-)');
    expect(formatOtherIncomeColumnLabel('pendapatan_kontanan', '(-)')).toBe('KONTANAN (-)');
    expect(formatOtherIncomeColumnLabel('pendapatan_bonus', '(+)')).toBe('PENDAPATAN BONUS (+)');
    expect(formatOtherIncomeColumnLabel('pendapatan_exgratia', '(+)')).toBe('PENDAPATAN BONUS (+)');
  });
});
