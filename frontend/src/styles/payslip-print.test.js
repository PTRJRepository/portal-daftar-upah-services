import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./payslip-print.css', import.meta.url), 'utf8');

describe('payslip print CSS', () => {
  it('uses the full A4 page for a 2x3 payslip grid without duplicate print margins', () => {
    expect(css).toMatch(/@page\s+payslip-portrait\s*{[^}]*size:\s*A4 portrait;[^}]*margin:\s*0;/);
    expect(css).not.toMatch(/@page\s*{[^}]*size:\s*A4 portrait/i);
    expect(css).toMatch(/\.payslip-a4-page\s*{[^}]*width:\s*210mm;[^}]*height:\s*297mm;[^}]*padding:\s*1\.5mm;/);
    expect(css).toMatch(/\.payslip-grid\s*{[^}]*width:\s*100%;[^}]*height:\s*100%;/);
    expect(css).toMatch(/\.payslip-grid\s*{[^}]*grid-template-columns:\s*1fr 1fr;[^}]*grid-template-rows:\s*repeat\(3,\s*1fr\);/);
    expect(css).toMatch(/\.payslip-grid\s*{[^}]*gap:\s*0\.9mm;/);
    expect(css).toMatch(/@media print[\s\S]*\.payslip-grid\s*{[\s\S]*width:\s*100%\s*!important;[\s\S]*height:\s*100%\s*!important;/);
    expect(css).toMatch(/@media print[\s\S]*\.payslip-grid\s*{[\s\S]*grid-template-rows:\s*repeat\(3,\s*1fr\)\s*!important;/);
    expect(css).toMatch(/@media print[\s\S]*\.payslip-grid\s*{[\s\S]*gap:\s*0\.9mm\s*!important;/);
    expect(css).toMatch(/@media print[\s\S]*\.payslip-print-container\s*{[\s\S]*page:\s*payslip-portrait;/);
  });

  it('prints dashed cut marks between the six portrait payslips', () => {
    expect(css).toMatch(/\.payslip-a4-page::before\s*{[\s\S]*left:\s*50%;[\s\S]*border-left:\s*0\.35mm dashed var\(--payslip-cut-rule\);/);
    expect(css).toMatch(/\.payslip-cut-line\s*{[\s\S]*border-top:\s*0\.35mm dashed var\(--payslip-cut-rule\);/);
    expect(css).toMatch(/\.payslip-cut-line--upper\s*{[\s\S]*top:\s*calc\(33\.333%/);
    expect(css).toMatch(/\.payslip-cut-line--lower\s*{[\s\S]*top:\s*calc\(66\.666%/);
    expect(css).toMatch(/@media print[\s\S]*\.payslip-a4-page::before,\s*[\s\S]*\.payslip-cut-line\s*{[\s\S]*display:\s*block\s*!important;/);
  });

  it('keeps the payslip symbol watermark professionally proportioned between card background and content', () => {
    expect(css).toMatch(/\.payslip-card\s*{[\s\S]*isolation:\s*isolate;/);
    expect(css).toMatch(/\.payslip-watermark\s*{[\s\S]*grid-template-columns:\s*repeat\(5,\s*1fr\);/);
    expect(css).toMatch(/\.payslip-watermark\s*{[\s\S]*grid-auto-rows:\s*9mm;/);
    expect(css).toMatch(/\.payslip-watermark\s*{[\s\S]*z-index:\s*1;/);
    expect(css).toMatch(/\.payslip-watermark__tile\s*{[\s\S]*opacity:\s*0\.11;/);
    expect(css).toMatch(/\.payslip-watermark__image\s*{[\s\S]*width:\s*6mm;/);
    expect(css).toMatch(/\.payslip-watermark__label\s*{[\s\S]*font-size:\s*5\.2pt;/);
    expect(css).toMatch(/\.payslip-card-header,\s*[\s\S]*\.payslip-note-section\s*{[\s\S]*z-index:\s*2;/);
  });

  it('centers and lifts the take-home-pay banner so it is prominent but not edge-to-edge', () => {
    expect(css).toMatch(/\.payslip-card\s*{[\s\S]*justify-content:\s*flex-start;/);
    expect(css).toMatch(/\.payslip-card-content\s*{[\s\S]*flex:\s*0 0 auto;/);
    expect(css).toMatch(/\.payslip-card-footer\s*{[\s\S]*align-self:\s*center;/);
    expect(css).toMatch(/\.payslip-card-footer\s*{[\s\S]*width:\s*94%;/);
    expect(css).toMatch(/\.payslip-card-footer\s*{[\s\S]*margin:\s*0\.1mm auto 0 auto;/);
    expect(css).toMatch(/\.payslip-card-footer\s*{[\s\S]*transform:\s*translateY\(-0\.15mm\);/);
    expect(css).toMatch(/\.payslip-card-footer\s*{[\s\S]*justify-content:\s*center;/);
    expect(css).toMatch(/\.payslip-thp-value\s*{[\s\S]*font-size:\s*7\.8pt;/);
  });

  it('centers the payslip header and keeps the header logo compact', () => {
    expect(css).toMatch(/\.payslip-card-header\s*{[\s\S]*text-align:\s*center;/);
    expect(css).toMatch(/\.payslip-card-header\s*{[\s\S]*display:\s*flex;/);
    expect(css).toMatch(/\.payslip-card-header\s*{[\s\S]*align-items:\s*center;/);
    expect(css).toMatch(/\.payslip-card-header\s*{[\s\S]*justify-content:\s*center;/);
    expect(css).toMatch(/\.payslip-card-header\s*{[\s\S]*padding:\s*0\.2mm 0\.4mm 0\.2mm 0\.4mm;/);
    expect(css).toMatch(/\.payslip-card-company\s*{[\s\S]*display:\s*grid;/);
    expect(css).toMatch(/\.payslip-card-company\s*{[\s\S]*grid-template-columns:\s*5\.6mm minmax\(0,\s*auto\) 5\.6mm;/);
    expect(css).toMatch(/\.payslip-card-company\s*{[\s\S]*justify-content:\s*center;/);
    expect(css).toMatch(/\.payslip-card-company::after\s*{[\s\S]*content:\s*'';/);
    expect(css).toMatch(/\.payslip-header-logo\s*{[\s\S]*width:\s*5\.6mm;/);
  });

  it('gives the income column more room than deductions on the compact payslip', () => {
    expect(css).toMatch(/\.payslip-card-column--income\s*{[\s\S]*flex:\s*1\.18 1 0;/);
    expect(css).toMatch(/\.payslip-card-column--deduction\s*{[\s\S]*flex:\s*0\.82 1 0;/);
  });
});
