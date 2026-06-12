import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./WagesSummaryRebinmasPage.jsx', import.meta.url), 'utf8');

describe('WagesSummaryRebinmasPage print style hooks', () => {
  it('marks non-THR Rebinmas wages reports with print-specific table classes', () => {
    expect(source).toContain('wages-rebinmas-print-document');
    expect(source).toContain('wages-rebinmas-summary-table');
    expect(source).toContain('wages-col-division');
    expect(source).toContain('wages-col-netpay');
    expect(source).toContain('wages-rebinmas-comparison-table');
    expect(source).toContain('wages-comparison-col-division');
    expect(source).toContain('wages-comparison-col-selisih');
  });

  it('renders division description before division code for print readability', () => {
    expect(source.indexOf('className="div-desc"')).toBeLessThan(source.indexOf('className="div-code"'));
  });

  it('uses a dedicated simplified print table for comparison mode', () => {
    expect(source).toContain("margin: comparisonMode ? '0' : '8mm'");
    expect(source).toContain("wages-comparison-page");
    expect(source).toContain('wages-comparison-screen-wrapper no-print');
    expect(source).toContain('wages-comparison-print-wrapper print-only');
    expect(source).toContain('wages-comparison-print-table');
    expect(source).toContain('wages-print-col-division');
    expect(source).toContain('UPAH BERSIH');
    expect(source).toContain('PERUBAHAN');
  });

  it('allows entering comparison mode from the Wages Summary page', () => {
    expect(source).toContain('setSearchParams');
    expect(source).toContain("nextParams.set('mode', 'comparison')");
    expect(source).toContain('Wages Comparison');
    expect(source).toContain('Back to Wages Summary');
  });
});
