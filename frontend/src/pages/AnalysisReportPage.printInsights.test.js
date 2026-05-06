import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./AnalysisReportPage.jsx', import.meta.url), 'utf8');

describe('AnalysisReportPage print insights', () => {
  it('uses the analysis insight helper for print-safe executive output', () => {
    expect(source).toContain("import { buildAnalysisReportInsights } from '../utils/analysisReportInsights';");
    expect(source).toContain('analysisInsights');
    expect(source).toContain('analysis-print-insights');
    expect(source).toContain('analysis-print-top-premi-table');
  });

  it('passes print-limited premi headers and rows to the appendix table', () => {
    expect(source).toContain('printPremiHeaders={analysisInsights.printPremiHeaders}');
    expect(source).toContain('printPremiRows={analysisInsights.printPremiRows}');
    expect(source).toContain('print_breakdown');
    expect(source).toContain('LAINNYA');
  });

  it('renders analysis rows as grouped gang-level output', () => {
    expect(source).toContain('AggregatedPremiOTTable');
    expect(source).toContain('groupedRows={analysisInsights.groupedRows}');
    expect(source).toContain('Agregat per Divisi');
    expect(source).toContain('Driver Gang');
    expect(source).toContain('analysis-gang-code');
    expect(source).not.toContain('analysis-division-cell');
  });
});
