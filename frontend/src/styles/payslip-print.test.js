import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./payslip-print.css', import.meta.url), 'utf8');

describe('payslip print CSS', () => {
  it('uses the full A4 page for a 2x2 payslip grid without duplicate print margins', () => {
    expect(css).toMatch(/@page\s+payslip-portrait\s*{[^}]*size:\s*A4 portrait;[^}]*margin:\s*0;/);
    expect(css).not.toMatch(/@page\s*{[^}]*size:\s*A4 portrait/i);
    expect(css).toMatch(/\.payslip-a4-page\s*{[^}]*width:\s*210mm;[^}]*height:\s*297mm;[^}]*padding:\s*3mm;/);
    expect(css).toMatch(/\.payslip-grid\s*{[^}]*width:\s*100%;[^}]*height:\s*100%;/);
    expect(css).toMatch(/@media print[\s\S]*\.payslip-grid\s*{[\s\S]*width:\s*100%\s*!important;[\s\S]*height:\s*100%\s*!important;/);
    expect(css).toMatch(/@media print[\s\S]*\.payslip-print-container\s*{[\s\S]*page:\s*payslip-portrait;/);
  });
});
