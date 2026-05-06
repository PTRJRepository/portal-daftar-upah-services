import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./payslip-print.css', import.meta.url), 'utf8');

describe('payslip print CSS', () => {
  it('uses the full A4 page for a 2x2 payslip grid without duplicate print margins', () => {
    expect(css).toMatch(/@page\s+payslip-portrait\s*{[^}]*size:\s*A4 portrait;[^}]*margin:\s*0;/);
    expect(css).not.toMatch(/@page\s*{[^}]*size:\s*A4 portrait/i);
    expect(css).toMatch(/\.payslip-a4-page\s*{[^}]*width:\s*210mm;[^}]*height:\s*297mm;[^}]*padding:\s*1\.5mm;/);
    expect(css).toMatch(/\.payslip-grid\s*{[^}]*width:\s*100%;[^}]*height:\s*100%;/);
    expect(css).toMatch(/\.payslip-grid\s*{[^}]*gap:\s*0;/);
    expect(css).toMatch(/@media print[\s\S]*\.payslip-grid\s*{[\s\S]*width:\s*100%\s*!important;[\s\S]*height:\s*100%\s*!important;/);
    expect(css).toMatch(/@media print[\s\S]*\.payslip-grid\s*{[\s\S]*gap:\s*0\s*!important;/);
    expect(css).toMatch(/@media print[\s\S]*\.payslip-print-container\s*{[\s\S]*page:\s*payslip-portrait;/);
  });

  it('prints dashed cut marks between the four portrait payslips', () => {
    expect(css).toMatch(/\.payslip-a4-page::before\s*{[\s\S]*left:\s*50%;[\s\S]*border-left:\s*0\.35mm dashed var\(--payslip-cut-rule\);/);
    expect(css).toMatch(/\.payslip-a4-page::after\s*{[\s\S]*top:\s*50%;[\s\S]*border-top:\s*0\.35mm dashed var\(--payslip-cut-rule\);/);
    expect(css).toMatch(/@media print[\s\S]*\.payslip-a4-page::before,\s*[\s\S]*\.payslip-a4-page::after\s*{[\s\S]*display:\s*block\s*!important;/);
  });

  it('keeps the payslip symbol watermark professionally proportioned between card background and content', () => {
    expect(css).toMatch(/\.payslip-card\s*{[\s\S]*isolation:\s*isolate;/);
    expect(css).toMatch(/\.payslip-watermark\s*{[\s\S]*grid-template-columns:\s*repeat\(4,\s*1fr\);/);
    expect(css).toMatch(/\.payslip-watermark\s*{[\s\S]*z-index:\s*1;/);
    expect(css).toMatch(/\.payslip-watermark__tile\s*{[\s\S]*opacity:\s*0\.09;/);
    expect(css).toMatch(/\.payslip-watermark__image\s*{[\s\S]*width:\s*12mm;/);
    expect(css).toMatch(/\.payslip-card-header,\s*[\s\S]*\.payslip-note-section\s*{[\s\S]*z-index:\s*2;/);
  });
});
