import { describe, expect, it } from 'vitest';
import {
  formatOtherIncomeColumnLabel,
  getEditableOtherIncomeConfig,
  getEditableOtherIncomeFields,
  getOtherIncomeDetailFields,
  isEditableOtherIncomeField,
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
  });
});

describe('editable other income helpers', () => {
  it('marks bonus, exgratia, and kontan as editable other income fields', () => {
    expect(getEditableOtherIncomeConfig('pendapatan_bonus')).toEqual({ type: 'BONUS', name: 'BONUS' });
    expect(getEditableOtherIncomeConfig('pendapatan_exgratia')).toEqual({ type: 'EXGRATIA', name: 'EXGRATIA' });
    expect(getEditableOtherIncomeConfig('pendapatan_kontan')).toEqual({ type: 'KONTAN', name: 'KONTAN' });
    expect(isEditableOtherIncomeField('pendapatan_thr')).toBe(false);
  });

  it('keeps active exgratia and always adds bonus and kontan edit columns', () => {
    expect(
      getEditableOtherIncomeFields(['pendapatan_thr', 'pendapatan_exgratia', 'pendapatan_lainnya']),
    ).toEqual([
      'pendapatan_exgratia',
      'pendapatan_bonus',
      'pendapatan_kontan',
    ]);
  });
});
