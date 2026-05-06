import { describe, expect, it } from 'vitest';
import {
  getDivisionDisplayLabel,
  getDivisionShortDescription,
  getReportDivisionSummary,
} from './divisionPresentation';

describe('divisionPresentation', () => {
  it('uses short local names for known Parit Gunung division aliases', () => {
    expect(getDivisionShortDescription('PG1A')).toBe('Parit Gunung 1A');
    expect(getDivisionShortDescription('P1A')).toBe('Parit Gunung 1A');
    expect(getDivisionDisplayLabel('PG2B')).toBe('PG2B - Parit Gunung 2B');
  });

  it('labels DME as Darrur Makmur Estate', () => {
    expect(getDivisionShortDescription('DME')).toBe('Darrur Makmur Estate');
    expect(getDivisionDisplayLabel('DME')).toBe('DME - Darrur Makmur Estate');
  });

  it('keeps backend descriptions concise for unknown or virtual divisions', () => {
    expect(getDivisionDisplayLabel('INF', 'Infrastruktur - semua gang berawalan IN dari Plasma 1A')).toBe('INF - Infrastruktur');
    expect(getDivisionDisplayLabel('XYZ', 'Divisi Percobaan Panjang')).toBe('XYZ - Divisi Percobaan Panjang');
  });

  it('summarizes all-division reports using visible row count', () => {
    expect(getReportDivisionSummary({
      division: '',
      divisionType: 'virtual',
      rows: [
        { division_code: 'INF' },
        { division_code: 'NRS' },
        { division_code: 'INF' },
        { division_code: 'GRAND', is_grand_total: true },
      ],
    })).toBe('ALL - Semua divisi virtual (2 divisi)');
  });
});
