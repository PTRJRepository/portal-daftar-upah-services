import { describe, expect, it } from 'vitest';
import { filterRowsByDivisionType, isVirtualReportDivision, normalizeDivisionType } from './reportDivisionType';

describe('reportDivisionType', () => {
  it('identifies current virtual report divisions', () => {
    expect(isVirtualReportDivision('INF')).toBe(true);
    expect(isVirtualReportDivision('NRS')).toBe(true);
    expect(isVirtualReportDivision('WKS_PG')).toBe(true);
    expect(isVirtualReportDivision('WKS_AR')).toBe(true);
    expect(isVirtualReportDivision('WORKSHOP')).toBe(true);
    expect(isVirtualReportDivision('P1A')).toBe(false);
  });

  it('normalizes unsupported division type values to all', () => {
    expect(normalizeDivisionType('real')).toBe('real');
    expect(normalizeDivisionType('virtual')).toBe('virtual');
    expect(normalizeDivisionType('unknown')).toBe('all');
    expect(normalizeDivisionType()).toBe('all');
  });

  it('filters rows by real and virtual division type', () => {
    const rows = [
      { division_code: 'P1A', total_upah_bersih: 100 },
      { division_code: 'INF', total_upah_bersih: 20 },
      { division_code: 'WKS_AR', total_upah_bersih: 30 },
    ];

    expect(filterRowsByDivisionType(rows, 'all').map(row => row.division_code)).toEqual(['P1A', 'INF', 'WKS_AR']);
    expect(filterRowsByDivisionType(rows, 'real').map(row => row.division_code)).toEqual(['P1A']);
    expect(filterRowsByDivisionType(rows, 'virtual').map(row => row.division_code)).toEqual(['INF', 'WKS_AR']);
  });
});
