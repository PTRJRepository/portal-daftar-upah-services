import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./PayrollHistoryComparison.css', import.meta.url), 'utf8');

describe('PayrollHistoryComparison print styles', () => {
  it('prints wages comparison headers as light cells with visible separators', () => {
    expect(css).toMatch(/@media print\s*{[\s\S]*\.phc-table thead th,\s*[\s\S]*\.phc-header-group th,\s*[\s\S]*\.phc-header-cols th,\s*[\s\S]*\.phc-th-group,\s*[\s\S]*\.phc-th-sticky\s*{[\s\S]*background:\s*#fff\s*!important;[\s\S]*color:\s*#000\s*!important;[\s\S]*border:\s*1pt solid #000\s*!important;/);
    expect(css).toMatch(/@media print\s*{[\s\S]*\.phc-header-group th\s*{[\s\S]*border-bottom:\s*1\.5pt solid #000\s*!important;/);
  });
});
