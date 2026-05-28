import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./SummaryReportPage.jsx', import.meta.url), 'utf8');

describe('SummaryReportPage print headers', () => {
  it('marks screen and print table headers with explicit print visibility classes', () => {
    expect(source).toContain('wsp-header-master no-print report-screen-header');
    expect(source).toContain('wsp-header-sub no-print report-screen-header');
    expect(source).toContain('wsp-header-master print-only report-print-header');
    expect(source).toContain('wsp-header-sub print-only report-print-header');
    expect(source).toContain('summary-detail-print-wrapper print-only');
    expect(source).toContain('summary-detail-print-table');
  });

  it('groups summary detail print rows and emphasizes gang description before gang code', () => {
    expect(source).toContain('groupedSummaryPrintRows');
    expect(source).toContain('summary-print-group-row');
    expect(source).toContain('buildGangDescriptionGroupLabel');
    expect(source).toContain('summaryGroupLabel.toUpperCase()');
    expect(source).not.toContain('GROUP {group}');
    expect(source.indexOf('summary-print-desc')).toBeLessThan(source.indexOf('summary-print-code'));
  });

  it('prints thumbprint once as a right-side table column spanning the summary body', () => {
    expect(source).toContain('THUMBPRINT');
    expect(source).toContain('summary-compare-value');
    expect(source).toContain('summary-compare-diff');
    expect(source).toContain('groupedSummaryScreenRows');
    expect(source).toContain('groupedSummaryPrintRows');
    expect(source).toContain('reportComparison');
    expect(source).toContain('summaryComparisonRowSpan');
    expect(source).not.toContain('printComparisonRowSpan');
    expect(source).toContain('filteredSummaryData.length + groupedSummaryPrintRows.length');
    expect(source).not.toContain('rowSpan={printComparisonRowSpan}');
    expect(source).toContain('summaryPrintComparisonRowSpan');
    expect(source).toContain('rowSpan={summaryPrintComparisonRowSpan}');
    expect(source).toContain('groupIdx === 0 && summaryPrintComparisonRowSpan > 0');
    expect(source).toContain('<td colSpan="8">{formatSummaryGroupLabel(summaryGroupLabel)}</td>');
    expect(source).toContain('Thumbprint: {formatNumber(reportComparison.thumbPrint)}');
    expect(source).toContain('Selisih: {formatNumber(reportComparison.selisih)}');
    expect(source).toContain('formatNumber(reportComparison.thumbPrint)');
    expect(source).toContain('formatNumber(reportComparison.selisih)');
    expect(source).toContain('filteredGrandTotal?.thumb_print');
    expect(source).toContain('filteredGrandTotal?.selisih');
    expect(source).toContain('summary-compare-cell');
    expect(source).toContain('summary-col-compare');
    expect(source).not.toContain('summary-compare-footer-cell');
    expect(source).not.toContain('summary-col-thumbprint');
    expect(source).not.toContain('summary-col-selisih');
  });

  it('exposes a reconciled premium breakdown report and total premi detail modal', () => {
    expect(source).toContain('Report Uraian Premi');
    expect(source).toContain('SummaryPremiumBreakdownReport');
    expect(source).toContain('SummaryPremiumDetailModal');
    expect(source).toContain('PREMI LAINNYA / SELISIH TOTAL');
    expect(source).toContain('Total uraian sama dengan total premi');
    expect(source).toContain('proses seeder berbasis upsert');
    expect(source).toContain('Indikasi Premi Double Count');
    expect(source).toContain('Premi Terindikasi Double');
    expect(source).toContain('getSummaryRowPremiumDoubleCount');
    expect(source).toContain('onClick={() => setPremiumDetailRow(row)}');
  });
});
