import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./wages-summary-professional.css', import.meta.url), 'utf8');

describe('wages summary professional print CSS', () => {
  it('does not print screen-only table header rows', () => {
    expect(css).toMatch(/@media\s+screen\s*{[\s\S]*tr\.no-print\s*{[\s\S]*display:\s*table-row\s*!important;/);
    expect(css).toMatch(/@media\s+print\s*{[\s\S]*tr\.no-print,\s*[\s\S]*th\.no-print,\s*[\s\S]*td\.no-print\s*{[\s\S]*display:\s*none\s*!important;/);
  });

  it('keeps comparison KPI cards fitted when values are long', () => {
    expect(css).toMatch(/\.wsp-kpi-grid\.comparison-grid\s*{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(css).toMatch(/\.wsp-kpi-card\.comparison-card\s*{[\s\S]*min-width:\s*0;/);
    expect(css).toMatch(/\.wsp-kpi-value\.comparison-main-value\s*{[\s\S]*overflow-wrap:\s*anywhere;/);
    expect(css).toMatch(/\.wsp-kpi-previous-line\s*{[\s\S]*overflow-wrap:\s*anywhere;/);
    expect(css).toMatch(/\.wsp-kpi-delta-chip\s*{[\s\S]*display:\s*inline-flex;/);
  });

  it('styles comparison direction arrows and compact breakdown cards', () => {
    expect(css).toMatch(/\.wsp-kpi-direction\s*{[\s\S]*display:\s*inline-flex;/);
    expect(css).toMatch(/\.wsp-kpi-direction\.up\s*{[\s\S]*color:\s*#dc2626;/);
    expect(css).toMatch(/\.wsp-kpi-direction\.down\s*{[\s\S]*color:\s*#16a34a;/);
    expect(css).toMatch(/\.wsp-mini-kpi-grid\s*{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(180px,\s*1fr\)\)/);
    expect(css).toMatch(/\.wsp-mini-kpi-card\s*{[\s\S]*min-width:\s*0;/);
  });
});
