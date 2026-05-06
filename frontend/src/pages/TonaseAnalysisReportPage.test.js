import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./TonaseAnalysisReportPage.jsx', import.meta.url), 'utf8');

describe('TonaseAnalysisReportPage source', () => {
  it('uses the tonase report API and print-safe report sections', () => {
    expect(source).toContain("import { fetchTonaseAnalysisReport } from '../services/dashboardService';");
    expect(source).toContain('tonase-trend-chart');
    expect(source).toContain('premium-breakdown-table');
    expect(source).toContain('division-breakdown-table');
    expect(source).toContain("printReport({ orientation: 'landscape' })");
    expect(source).toContain('id="tonase-analysis-report-content"');
  });

  it('renders the requested efficiency metrics', () => {
    expect(source).toContain('Upah Bersih / HK');
    expect(source).toContain('Premi / HK');
    expect(source).toContain('Upah Bersih / Ton');
    expect(source).toContain('Premi / Ton');
    expect(source).toContain('Uraian Premi');
    expect(source).toContain('Breakdown Divisi/Estate');
    expect(source).toContain('Total Seluruh Rebinmas');
    expect(source).toContain("division_code: 'REBINMAS'");
    expect(source).toContain('reportData.division_breakdown');
    expect(source).toContain('viewMode');
    expect(source).toContain('Mode Detail');
    expect(source).toContain('detailViewMode');
    expect(source).toContain('Current Month');
    expect(source).toContain('Trend 5 Bulan');
    expect(source).toContain('tonase-document-mode');
    expect(source).toContain('Mode Tampilan');
    expect(source).toContain('handleDisplayModeChange');
    expect(source).toContain('displayModeKey');
    expect(source).toContain('activeScopeLabel');
    expect(source).toContain('displayKpis');
    expect(source).toContain('selectedDivisionDetail?.trend');
    expect(source).toContain('selectedDivisionCode');
    expect(source).toContain('reportData.division_details');
    expect(source).toContain('Detail Current Month');
    expect(source).toContain('Detail Trend 5 Bulan');
    expect(source).toContain('Sumber Tonase');
    expect(source).toContain('Gang Panen');
  });
});
