import { describe, expect, it } from 'vitest';
import { parseSalaryRangeRouteParams } from './reportRouteParams';

describe('parseSalaryRangeRouteParams', () => {
  it('reads salary range route query params with numeric fallbacks', () => {
    expect(parseSalaryRangeRouteParams('?month=4&year=2025&min_salary=7000000&max_salary=9000000', {
      month: 1,
      year: 2024,
      minSalary: 6000000,
    })).toEqual({
      month: 4,
      year: 2025,
      minSalary: 7000000,
      maxSalary: 9000000,
    });

    expect(parseSalaryRangeRouteParams('?month=x&min_salary=', {
      month: 2,
      year: 2026,
      minSalary: 6000000,
    })).toEqual({
      month: 2,
      year: 2026,
      minSalary: 6000000,
      maxSalary: null,
    });
  });
});
