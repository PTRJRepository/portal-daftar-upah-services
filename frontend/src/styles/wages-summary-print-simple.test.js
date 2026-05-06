import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./wages-summary-print-simple.css', import.meta.url), 'utf8');

describe('wages summary simple print CSS', () => {
  it('uses larger centered print typography for non-THR Rebinmas wages tables', () => {
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wages-rebinmas-summary-table\s*{[\s\S]*table-layout:\s*fixed\s*!important;[\s\S]*font-size:\s*9pt\s*!important;/);
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wages-rebinmas-summary-table th,\s*[\s\S]*\.wages-rebinmas-print-document \.wages-rebinmas-summary-table td\s*{[\s\S]*text-align:\s*center\s*!important;[\s\S]*font-size:\s*8\.8pt\s*!important;/);
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wages-rebinmas-summary-table td\.text-right\s*{[\s\S]*text-align:\s*center\s*!important;/);
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wages-rebinmas-summary-table \.wages-col-division\s*{[\s\S]*width:\s*18%\s*!important;/);
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wages-rebinmas-summary-table \.wages-col-netpay\s*{[\s\S]*width:\s*14%\s*!important;/);
  });

  it('keeps division descriptions stronger than codes and enlarges comparison print text slightly', () => {
    expect(css).toMatch(/\.wages-rebinmas-print-document \.div-desc\s*{[\s\S]*font-size:\s*8pt\s*!important;[\s\S]*font-weight:\s*900\s*!important;/);
    expect(css).toMatch(/\.wages-rebinmas-print-document \.div-code\s*{[\s\S]*font-size:\s*6\.8pt\s*!important;[\s\S]*font-weight:\s*600\s*!important;/);
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wages-rebinmas-comparison-table th,\s*[\s\S]*\.wages-rebinmas-print-document \.wages-rebinmas-comparison-table td\s*{[\s\S]*font-size:\s*8pt\s*!important;/);
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wages-rebinmas-comparison-table \.wages-comparison-col-division\s*{[\s\S]*width:\s*18%\s*!important;/);
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wages-rebinmas-comparison-table \.wages-comparison-col-selisih\s*{[\s\S]*width:\s*8%\s*!important;/);
  });

  it('prints Wages Rebinmas letterhead horizontally with a large left logo', () => {
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wsp-letterhead\s*{[\s\S]*display:\s*grid\s*!important;[\s\S]*grid-template-columns:\s*30mm minmax\(0,\s*1fr\)\s*!important;/);
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wsp-letterhead \.wsp-logo\s*{[\s\S]*grid-column:\s*1\s*!important;[\s\S]*grid-row:\s*1 \/ span 5\s*!important;[\s\S]*width:\s*28mm\s*!important;/);
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wsp-letterhead \.wsp-company-name,\s*[\s\S]*\.wages-rebinmas-print-document \.wsp-letterhead \.wsp-report-title,\s*[\s\S]*\.wages-rebinmas-print-document \.wsp-letterhead \.wsp-report-subtitle,\s*[\s\S]*\.wages-rebinmas-print-document \.wsp-letterhead \.wsp-report-period,\s*[\s\S]*\.wages-rebinmas-print-document \.wsp-letterhead \.report-print-meta-grid,\s*[\s\S]*\.wages-rebinmas-print-document \.wsp-letterhead \.report-print-note\s*{[\s\S]*grid-column:\s*2\s*!important;[\s\S]*text-align:\s*left\s*!important;/);
  });

  it('uses a dedicated fixed print table for Wages Rebinmas comparison mode', () => {
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wages-comparison-print-table\s*{[\s\S]*table-layout:\s*fixed\s*!important;[\s\S]*font-size:\s*8\.5pt\s*!important;/);
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wages-comparison-print-table \.wages-print-col-division\s*{[\s\S]*width:\s*18%\s*!important;/);
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wages-comparison-print-table \.wages-print-col-selisih\s*{[\s\S]*width:\s*8%\s*!important;/);
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wages-comparison-print-table th,\s*[\s\S]*\.wages-rebinmas-print-document \.wages-comparison-print-table td\s*{[\s\S]*text-align:\s*center\s*!important;[\s\S]*font-size:\s*8\.2pt\s*!important;/);
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wages-comparison-print-table \.trend-indicator\s*{[\s\S]*display:\s*inline-flex\s*!important;/);
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wages-comparison-cell-value\s*{[\s\S]*display:\s*inline-flex\s*!important;/);
  });

  it('keeps wages print headers light with black separator borders', () => {
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wages-rebinmas-summary-table thead th\s*{[\s\S]*background:\s*white\s*!important;[\s\S]*color:\s*#000\s*!important;[\s\S]*border:\s*1pt solid #000\s*!important;/);
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wages-comparison-print-table thead th\s*{[\s\S]*background:\s*white\s*!important;[\s\S]*color:\s*#000\s*!important;[\s\S]*border:\s*1pt solid #000\s*!important;/);
    expect(css).toMatch(/\.wages-rebinmas-print-document \.wages-comparison-print-table thead tr\.wsp-header-master th\s*{[\s\S]*border-bottom:\s*1\.5pt solid #000\s*!important;/);
  });
});
