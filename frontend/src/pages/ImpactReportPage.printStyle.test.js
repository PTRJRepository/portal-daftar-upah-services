import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./ImpactReportPage.jsx', import.meta.url), 'utf8');
const printCss = readFileSync(new URL('../styles/report-print-foundation.css', import.meta.url), 'utf8');

describe('ImpactReportPage print style hooks', () => {
  it('marks the impact report document and sections with print-specific classes', () => {
    expect(source).toContain('id="impact-report-content"');
    expect(source).toContain('impact-print-document');
    expect(source).toContain('impact-main-table');
    expect(source).toContain('impact-bottom-section');
    expect(source).toContain('impact-side-table');
    expect(source).toContain('impact-pruning-table');
    expect(source).toContain('impact-financial-table');
    expect(source).toContain('impact-summary-table');
  });

  it('defines stable print columns for the wide impact main table', () => {
    expect(source).toContain('impact-col-estate');
    expect(source).toContain('impact-col-luas');
    expect(source).toContain('impact-col-worker');
    expect(source).toContain('impact-col-money');
    expect(source).toContain('impact-col-tbs');
    expect(source).toContain('impact-col-percent');
  });

  it('has dedicated print CSS that keeps the impact report compact and readable', () => {
    expect(source).toContain("printReport({ orientation: 'landscape', margin: '10mm' })");
    expect(printCss).toMatch(/@page\s+report-impact\s*{[\s\S]*size:\s*A4 landscape;[\s\S]*margin:\s*10mm;/);
    expect(printCss).toMatch(/#impact-report-content\.impact-print-document\s*{[\s\S]*padding:\s*0\s*!important;/);
    expect(printCss).toMatch(/#impact-report-content\.impact-print-document\s*{[\s\S]*width:\s*100%\s*!important;/);
    expect(printCss).toMatch(/#impact-report-content\.impact-print-document\s*{[\s\S]*max-width:\s*100%\s*!important;/);
    expect(printCss).toMatch(/#impact-report-content\.impact-print-document\s*{[\s\S]*box-sizing:\s*border-box\s*!important;/);
    expect(printCss).toMatch(/#impact-report-content \.impact-main-table\s*{[\s\S]*table-layout:\s*fixed\s*!important;/);
    expect(printCss).toMatch(/#impact-report-content \.impact-main-table \.impact-col-estate\s*{[\s\S]*width:\s*15%\s*!important;/);
    expect(printCss).toMatch(/#impact-report-content \.impact-main-table \.impact-col-money\s*{[\s\S]*width:\s*8\.5%\s*!important;/);
    expect(printCss).toMatch(/#impact-report-content \.impact-bottom-section\s*{[\s\S]*display:\s*grid\s*!important;/);
    expect(printCss).toMatch(/#impact-report-content \.impact-bottom-section\s*{[\s\S]*break-before:\s*auto\s*!important;/);
    expect(printCss).toMatch(/#impact-report-content \.impact-bottom-section\s*{[\s\S]*page-break-before:\s*auto\s*!important;/);
    expect(printCss).not.toMatch(/#impact-report-content \.impact-bottom-section\s*{[\s\S]*page-break-before:\s*always\s*!important;/);
    expect(printCss).toMatch(/#impact-report-content \.impact-side-table\s*{[\s\S]*table-layout:\s*fixed\s*!important;/);
  });

  it('prints impact table headers as light cells with visible separators', () => {
    expect(printCss).toMatch(/#impact-report-content \.impact-main-table thead tr\.wsp-header-master th\s*{[\s\S]*background:\s*#fff\s*!important;[\s\S]*color:\s*#000\s*!important;[\s\S]*border:\s*0\.85pt solid #000\s*!important;/);
    expect(printCss).toMatch(/#impact-report-content \.impact-main-table thead th\s*{[\s\S]*background:\s*#fff\s*!important;[\s\S]*color:\s*#000\s*!important;[\s\S]*border:\s*0\.75pt solid #000\s*!important;/);
    expect(printCss).toMatch(/#impact-report-content \.impact-side-table thead th\s*{[\s\S]*background:\s*#fff\s*!important;[\s\S]*color:\s*#000\s*!important;[\s\S]*border:\s*0\.75pt solid #000\s*!important;/);
  });
});
