import { describe, expect, it } from 'vitest';
import { getDivisionTypeLabel, getReportModeLabel, getSourceModeLabel } from './reportPresentationLabels';

describe('reportPresentationLabels', () => {
  it('labels report modes consistently', () => {
    expect(getReportModeLabel({ thrMode: true, comparisonMode: true })).toBe('THR');
    expect(getReportModeLabel({ comparisonMode: true })).toBe('Perbandingan');
    expect(getReportModeLabel()).toBe('Standar');
  });

  it('labels source mode explicitly', () => {
    expect(getSourceModeLabel({ useHistory: true })).toBe('History DB');
    expect(getSourceModeLabel({ useHistory: false })).toBe('Origin DB');
    expect(getSourceModeLabel({ sourceMode: 'Summary API' })).toBe('Summary API');
  });

  it('labels division type scope for reports', () => {
    expect(getDivisionTypeLabel('real')).toBe('Real Only');
    expect(getDivisionTypeLabel('virtual')).toBe('Virtual Only');
    expect(getDivisionTypeLabel('all')).toBe('Real + Virtual');
    expect(getDivisionTypeLabel('unknown')).toBe('Real + Virtual');
  });
});
