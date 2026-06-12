import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./report-print-foundation.css', import.meta.url), 'utf8');

describe('report print foundation CSS', () => {
  it('prints only report print headers and hides screen headers in report tables', () => {
    expect(css).toMatch(/\.report-print-header\s*{[\s\S]*display:\s*none\s*!important;/);
    expect(css).toMatch(/@media\s+print\s*{[\s\S]*\.wsp-table thead tr\.report-screen-header[\s\S]*display:\s*none\s*!important;/);
    expect(css).toMatch(/@media\s+print\s*{[\s\S]*\.wsp-table thead tr\.report-print-header[\s\S]*display:\s*table-row\s*!important;/);
  });

  it('uses a fixed centered print table for the summary premi appendix', () => {
    expect(css).toMatch(/#summary-premi-appendix-content \.summary-premi-appendix-table\s*{[\s\S]*table-layout:\s*fixed\s*!important;/);
    expect(css).toMatch(/#summary-premi-appendix-content \.summary-premi-appendix-table th,\s*[\s\S]*#summary-premi-appendix-content \.summary-premi-appendix-table td[\s\S]*text-align:\s*center\s*!important;/);
    expect(css).toMatch(/#summary-premi-appendix-content \.summary-premi-appendix-table \.summary-col-no\s*{[\s\S]*width:\s*5%\s*!important;/);
    expect(css).toMatch(/#summary-premi-appendix-content \.summary-premi-appendix-table \.summary-col-gang\s*{[\s\S]*width:\s*25%\s*!important;/);
    expect(css).toMatch(/#summary-premi-appendix-content \.summary-premi-appendix-table \.summary-col-premi\s*{[\s\S]*width:\s*16%\s*!important;/);
    expect(css).toMatch(/#summary-premi-appendix-content \.summary-premi-appendix-table \.summary-col-premi-detail\s*{[\s\S]*width:\s*54%\s*!important;/);
    expect(css).toMatch(/#summary-premi-appendix-content \.summary-premi-appendix-table \.summary-premi-breakdown-cell\s*{[\s\S]*text-align:\s*left\s*!important;/);
  });

  it('keeps the summary premi appendix isolated on its own printable page', () => {
    expect(css).toMatch(/#summary-premi-appendix-content\.wsp-document\s*{[\s\S]*page-break-before:\s*always\s*!important;/);
    expect(css).toMatch(/#summary-premi-appendix-content\.wsp-document\s*{[\s\S]*break-before:\s*page\s*!important;/);
    expect(css).toMatch(/#summary-premi-appendix-content \.summary-premi-appendix-table tr\s*{[\s\S]*page-break-inside:\s*avoid\s*!important;/);
  });

  it('starts the summary premi appendix on a separate print page', () => {
    expect(css).toMatch(/#summary-report-content\.wsp-document\s*{[\s\S]*page-break-after:\s*always\s*!important;/);
    expect(css).toMatch(/#summary-report-content\.wsp-document\s*{[\s\S]*break-after:\s*page\s*!important;/);
  });

  it('uses compact summary report header and KPI spacing so detail rows can start on page one', () => {
    expect(css).toMatch(/#summary-report-content \.wsp-letterhead\s*{[\s\S]*display:\s*grid\s*!important;[\s\S]*margin:\s*0 0 4pt 0\s*!important;/);
    expect(css).toMatch(/#summary-report-content \.wsp-logo\s*{[\s\S]*width:\s*20mm\s*!important;/);
    expect(css).toMatch(/#summary-report-content \.wsp-kpi-grid\s*{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)\s*!important;[\s\S]*margin:\s*4pt 0 5pt 0\s*!important;/);
    expect(css).toMatch(/#summary-report-content \.wsp-kpi-card\s*{[\s\S]*padding:\s*3pt\s*!important;/);
  });

  it('prints wages summary headers as light cells with visible separators', () => {
    expect(css).toMatch(/#wsp-report-content \.wsp-table thead tr\.wsp-header-master th\s*{[\s\S]*background:\s*#fff\s*!important;[\s\S]*color:\s*#000\s*!important;[\s\S]*border:\s*0\.85pt solid #000\s*!important;[\s\S]*border-bottom:\s*1\.4pt solid #000\s*!important;/);
    expect(css).toMatch(/#wsp-report-content \.wsp-table thead tr\.wsp-header-sub th\s*{[\s\S]*background:\s*#fff\s*!important;[\s\S]*color:\s*#000\s*!important;[\s\S]*border:\s*0\.75pt solid #000\s*!important;/);
  });

  it('keeps summary detail comparison columns stable on screen', () => {
    expect(css).toMatch(/\.summary-detail-screen-table\s*{[\s\S]*min-width:\s*1180px;/);
    expect(css).toMatch(/\.summary-detail-screen-table \.summary-compare-cell\s*{[\s\S]*min-width:\s*150px;/);
  });

  it('prints grouped summary rows with description emphasized over gang code', () => {
    expect(css).toMatch(/#summary-premi-appendix-content \.summary-premi-appendix-table \.summary-print-desc\s*{[\s\S]*font-size:\s*8pt\s*!important;[\s\S]*font-weight:\s*900\s*!important;/);
    expect(css).toMatch(/#summary-premi-appendix-content \.summary-premi-appendix-table \.summary-print-code\s*{[\s\S]*font-size:\s*6\.8pt\s*!important;[\s\S]*font-weight:\s*600\s*!important;/);
    expect(css).toMatch(/#summary-premi-appendix-content \.summary-premi-appendix-table \.summary-print-group-row td\s*{[\s\S]*text-align:\s*left\s*!important;/);
  });

  it('uses readable summary premi appendix print font sizes', () => {
    expect(css).toMatch(/#summary-premi-appendix-content \.summary-premi-appendix-table\s*{[\s\S]*font-size:\s*8pt\s*!important;/);
    expect(css).toMatch(/#summary-premi-appendix-content \.summary-premi-appendix-table tbody td,\s*[\s\S]*#summary-premi-appendix-content \.summary-premi-appendix-table tfoot td\s*{[\s\S]*font-size:\s*8pt\s*!important;/);
  });

  it('prints a professional repeated symbol watermark above report backgrounds and below content', () => {
    expect(css).toMatch(/\.report-watermark__pattern\s*{[\s\S]*grid-template-columns:\s*repeat\(7,\s*1fr\)/);
    expect(css).toMatch(/\.report-watermark__tile\s*{[\s\S]*opacity:\s*0\.075\s*!important;/);
    expect(css).toMatch(/\.report-watermark__image\s*{[\s\S]*width:\s*18mm\s*!important;/);
    expect(css).toMatch(/\.report-watermark\s*~\s*\*\s*{[\s\S]*z-index:\s*2\s*!important;/);
    expect(css).toMatch(/\.wsp-document,\s*[\s\S]*\.comparison-report-container\s*{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.88\)\s*!important;/);
  });

  it('scopes analysis report print insights and top-premi appendix to prevent overflow', () => {
    expect(css).toMatch(/#wsp-report-content \.analysis-print-insights\s*{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)\s*!important;/);
    expect(css).toMatch(/#wsp-report-content \.analysis-print-top-premi-table\s*{[\s\S]*table-layout:\s*fixed\s*!important;/);
    expect(css).toMatch(/#wsp-report-content \.analysis-print-top-premi-table th,\s*[\s\S]*#wsp-report-content \.analysis-print-top-premi-table td\s*{[\s\S]*overflow-wrap:\s*anywhere\s*!important;/);
  });

});
