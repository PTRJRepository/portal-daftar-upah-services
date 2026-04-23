import { describe, expect, it } from 'vitest';
import {
  buildPeriodSliderPeriods,
  getPeriodSliderIndex,
  getPeriodSliderScrollLeft,
} from './periodSliderState';

describe('buildPeriodSliderPeriods', () => {
  it('limits future months on the max year', () => {
    const periods = buildPeriodSliderPeriods(2026, 2027, new Date(2026, 2, 1));
    expect(periods.some((item) => item.year === 2027 && item.month === 6)).toBe(false);
    expect(periods.some((item) => item.year === 2027 && item.month === 4)).toBe(true);
  });
});

describe('getPeriodSliderIndex', () => {
  it('finds the active period', () => {
    const periods = [{ month: 3, year: 2026 }, { month: 4, year: 2026 }];
    expect(getPeriodSliderIndex(periods, 4, 2026)).toBe(1);
    expect(getPeriodSliderIndex(periods, 5, 2026)).toBe(-1);
  });
});

describe('getPeriodSliderScrollLeft', () => {
  it('centers the current period within the wrapper', () => {
    expect(getPeriodSliderScrollLeft(3, 320, 80)).toBe(120);
    expect(getPeriodSliderScrollLeft(-1, 320, 80)).toBe(0);
  });
});
