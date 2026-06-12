import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./payslip-print.css', import.meta.url), 'utf8');

describe('payslip print CSS', () => {
  it('uses the full A4 page for a 2x2 payslip grid with a small print-safe page margin', () => {
    expect(css).toMatch(/@page\s+payslip-portrait\s*{[^}]*size:\s*A4 portrait;[^}]*margin:\s*0;/);
    expect(css).not.toMatch(/@page\s*{[^}]*size:\s*A4 portrait/i);
    expect(css).toMatch(/\.payslip-a4-page\s*{[^}]*width:\s*210mm;[^}]*height:\s*297mm;[^}]*padding:\s*3mm;/);
    expect(css).toMatch(/\.payslip-grid\s*{[^}]*width:\s*100%;[^}]*height:\s*100%;/);
    expect(css).toMatch(/\.payslip-grid\s*{[^}]*grid-template-columns:\s*1fr 1fr;[^}]*grid-template-rows:\s*repeat\(2,\s*1fr\);/);
    expect(css).toMatch(/\.payslip-grid\s*{[^}]*gap:\s*0;/);
    expect(css).toMatch(/@media print[\s\S]*\.payslip-grid\s*{[\s\S]*width:\s*100%\s*!important;[\s\S]*height:\s*100%\s*!important;/);
    expect(css).toMatch(/@media print[\s\S]*\.payslip-grid\s*{[\s\S]*grid-template-rows:\s*repeat\(2,\s*1fr\)\s*!important;/);
    expect(css).toMatch(/@media print[\s\S]*\.payslip-grid\s*{[\s\S]*gap:\s*0\s*!important;/);
    expect(css).toMatch(/@media print[\s\S]*\.payslip-print-container\s*{[\s\S]*page:\s*payslip-portrait;/);
  });

  it('prints dashed cut marks between the four portrait payslips', () => {
    expect(css).toMatch(/\.payslip-a4-page::before\s*{[\s\S]*left:\s*50%;[\s\S]*border-left:\s*0\.35mm dashed var\(--payslip-cut-rule\);/);
    expect(css).toMatch(/\.payslip-cut-line\s*{[\s\S]*border-top:\s*0\.35mm dashed var\(--payslip-cut-rule\);/);
    expect(css).toMatch(/\.payslip-cut-line--middle\s*{[\s\S]*top:\s*50%;/);
    expect(css).not.toContain('payslip-cut-line--upper');
    expect(css).not.toContain('payslip-cut-line--lower');
    expect(css).not.toContain('payslip-cut-line--quarter');
    expect(css).not.toContain('payslip-cut-line--three-quarter');
    expect(css).toMatch(/@media print[\s\S]*\.payslip-a4-page::before,\s*[\s\S]*\.payslip-cut-line\s*{[\s\S]*display:\s*block\s*!important;/);
  });

  it('keeps the payslip symbol watermark professionally proportioned between card background and content', () => {
    expect(css).toMatch(/\.payslip-card\s*{[\s\S]*isolation:\s*isolate;/);
    expect(css).toMatch(/\.payslip-watermark\s*{[\s\S]*grid-template-columns:\s*repeat\(5,\s*1fr\);/);
    expect(css).toMatch(/\.payslip-watermark\s*{[\s\S]*grid-auto-rows:\s*11mm;/);
    expect(css).toMatch(/\.payslip-watermark\s*{[\s\S]*z-index:\s*1;/);
    expect(css).toMatch(/\.payslip-watermark__tile\s*{[\s\S]*opacity:\s*0\.11;/);
    expect(css).toMatch(/\.payslip-watermark__image\s*{[\s\S]*width:\s*7mm;/);
    expect(css).toMatch(/\.payslip-watermark__label\s*{[\s\S]*font-size:\s*5\.8pt;/);
    expect(css).toMatch(/\.payslip-card-header,\s*[\s\S]*\.payslip-note-section\s*{[\s\S]*z-index:\s*2;/);
  });

  it('centers and lifts the take-home-pay banner so it is prominent but not edge-to-edge', () => {
    expect(css).toMatch(/\.payslip-card\s*{[\s\S]*justify-content:\s*flex-start;/);
    expect(css).toMatch(/\.payslip-card-content\s*{[\s\S]*flex:\s*1 1 auto;/);
    expect(css).toMatch(/\.payslip-card-content\s*{[\s\S]*min-height:\s*0;/);
    expect(css).toMatch(/\.payslip-card-content\s*{[\s\S]*overflow:\s*hidden;/);
    expect(css).toMatch(/\.payslip-card-footer\s*{[\s\S]*align-self:\s*center;/);
    expect(css).toMatch(/\.payslip-card-footer\s*{[\s\S]*width:\s*94%;/);
    expect(css).toMatch(/\.payslip-card-footer\s*{[\s\S]*margin:\s*0\.45mm auto 0\.65mm auto;/);
    expect(css).toMatch(/\.payslip-card-footer\s*{[\s\S]*transform:\s*translateY\(-0\.65mm\);/);
    expect(css).toMatch(/\.payslip-card-footer\s*{[\s\S]*justify-content:\s*center;/);
    expect(css).toMatch(/\.payslip-card-footer\s*{[\s\S]*flex:\s*0 0 auto;/);
    expect(css).toMatch(/\.payslip-thp-value\s*{[\s\S]*font-size:\s*12pt;/);
  });

  it('reserves printable space for take-home-pay and routes long income detail below deductions', () => {
    expect(css).toMatch(/\.payslip-card-content\s*{[\s\S]*flex:\s*1 1 auto;/);
    expect(css).toMatch(/@media print[\s\S]*\.payslip-card-content\s*{[\s\S]*flex:\s*1 1 auto\s*!important;/);
    expect(css).toMatch(/\.pdf-export-active\.payslip-print-container\s+\.payslip-card-content\s*{[\s\S]*flex:\s*1 1 auto\s*!important;/);
    expect(css).toMatch(/\.payslip-card-column--deduction\s*{[\s\S]*border-left:\s*1px solid var\(--payslip-rule\);/);
    expect(css).not.toContain('payslip-income-overflow-section');
    expect(css).not.toContain('payslip-overflow-divider');
  });

  it('centers the payslip header and keeps the header logo compact', () => {
    expect(css).toMatch(/\.payslip-card-header\s*{[\s\S]*text-align:\s*center;/);
    expect(css).toMatch(/\.payslip-card-header\s*{[\s\S]*display:\s*flex;/);
    expect(css).toMatch(/\.payslip-card-header\s*{[\s\S]*align-items:\s*center;/);
    expect(css).toMatch(/\.payslip-card-header\s*{[\s\S]*justify-content:\s*center;/);
    expect(css).toMatch(/\.payslip-card-header\s*{[\s\S]*padding:\s*0\.45mm 0\.6mm 0\.45mm 0\.6mm;/);
    expect(css).toMatch(/\.payslip-card-company\s*{[\s\S]*display:\s*grid;/);
    expect(css).toMatch(/\.payslip-card-company\s*{[\s\S]*grid-template-columns:\s*7\.2mm minmax\(0,\s*auto\) 7\.2mm;/);
    expect(css).toMatch(/\.payslip-card-company\s*{[\s\S]*justify-content:\s*center;/);
    expect(css).toMatch(/\.payslip-card-company::after\s*{[\s\S]*content:\s*'';/);
    expect(css).toMatch(/\.payslip-header-logo\s*{[\s\S]*width:\s*7\.2mm;/);
  });

  it('uses a larger readable scale for both screen preview and print while keeping four slips on one portrait page', () => {
    expect(css).toMatch(/\.payslip-card\s*{[\s\S]*padding:\s*1\.25mm 1\.4mm;/);
    expect(css).toMatch(/\.payslip-card\s*{[\s\S]*font-size:\s*7\.45pt;/);
    expect(css).toMatch(/\.payslip-card\s*{[\s\S]*line-height:\s*1\.15;/);
    expect(css).toMatch(/\.payslip-card-company\s*{[\s\S]*font-size:\s*8\.6pt;/);
    expect(css).toMatch(/\.payslip-card-title\s*{[\s\S]*font-size:\s*8\.1pt;/);
    expect(css).toMatch(/\.payslip-card-period\s*{[\s\S]*font-size:\s*7pt;/);
    expect(css).toMatch(/\.payslip-card-info\s*{[\s\S]*font-size:\s*7pt;/);
    expect(css).toMatch(/\.payslip-activity-summary\s*{[\s\S]*font-size:\s*6\.9pt;/);
    expect(css).toMatch(/\.payslip-column-header\s*{[\s\S]*font-size:\s*7\.5pt;/);
    expect(css).toMatch(/\.payslip-item\s*{[\s\S]*font-size:\s*7\.05pt;/);
    expect(css).toMatch(/\.payslip-item-value\s*{[\s\S]*width:\s*100%;/);
    expect(css).toMatch(/\.payslip-subtotal-line\s*{[\s\S]*font-size:\s*6\.9pt;/);
    expect(css).toMatch(/\.payslip-total-line\s*{[\s\S]*font-size:\s*7\.45pt;/);
    expect(css).toMatch(/@media print[\s\S]*\.payslip-card\s*{[\s\S]*padding:\s*1\.25mm 1\.4mm\s*!important;/);
    expect(css).toMatch(/@media print[\s\S]*\.payslip-card\s*{[\s\S]*font-size:\s*7\.45pt\s*!important;/);
  });

  it('keeps component labels and amounts close together while preserving aligned amount columns', () => {
    expect(css).toMatch(/\.payslip-item\s*{[\s\S]*display:\s*grid;/);
    expect(css).toMatch(/\.payslip-item\s*{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) 13mm;/);
    expect(css).toMatch(/\.payslip-item\s*{[\s\S]*column-gap:\s*0\.7mm;/);
    expect(css).toMatch(/\.payslip-item\s*{[\s\S]*width:\s*min\(100%,\s*52mm\);/);
    expect(css).toMatch(/\.payslip-card-column--deduction\s+\.payslip-item\s*{[\s\S]*width:\s*100%;/);
    expect(css).toMatch(/\.payslip-item-label\s*{[\s\S]*text-overflow:\s*ellipsis;/);
    expect(css).toMatch(/\.payslip-item-value\s*{[\s\S]*justify-self:\s*end;/);
    expect(css).toMatch(/\.payslip-item-value\s*{[\s\S]*flex:\s*0 0 auto;/);
    expect(css).toMatch(/\.total-line-wrapper\s*{[\s\S]*width:\s*min\(100%,\s*52mm\);/);
  });

  it('gives the income column more room than deductions on the compact payslip', () => {
    expect(css).toMatch(/\.payslip-card-column--income\s*{[\s\S]*flex:\s*1\.24 1 0;/);
    expect(css).toMatch(/\.payslip-card-column--deduction\s*{[\s\S]*flex:\s*0\.76 1 0;/);
  });

  it('does not keep unused compact tax-breakdown styles in the printable slip', () => {
    expect(css).not.toContain('payslip-tax-breakdown');
  });

  it('uses print-stable A4 sizing when html2pdf captures the cloned payslip container', () => {
    expect(css).toMatch(/\.pdf-export-active\.payslip-print-container\s*{[\s\S]*background:\s*white\s*!important;[\s\S]*padding:\s*0\s*!important;[\s\S]*gap:\s*0\s*!important;/);
    expect(css).toMatch(/\.pdf-export-active\.payslip-print-container\s*{[\s\S]*width:\s*210mm\s*!important;[\s\S]*min-height:\s*auto\s*!important;/);
    expect(css).toMatch(/\.pdf-export-active\.payslip-print-container\s+\.payslip-a4-page\s*{[\s\S]*width:\s*210mm\s*!important;[\s\S]*height:\s*297mm\s*!important;/);
    expect(css).toMatch(/\.pdf-export-active\.payslip-print-container\s+\.payslip-a4-page\s*{[\s\S]*margin:\s*0\s*!important;[\s\S]*box-shadow:\s*none\s*!important;/);
    expect(css).toMatch(/\.pdf-export-active\.payslip-print-container\s+\.payslip-a4-page\s*{[\s\S]*padding:\s*3mm\s*!important;/);
    expect(css).toMatch(/\.pdf-export-active\.payslip-print-container\s+\.payslip-grid\s*{[\s\S]*grid-template-rows:\s*repeat\(2,\s*1fr\)\s*!important;/);
    expect(css).toMatch(/\.pdf-export-active\.payslip-print-container\s+\.payslip-card\s*{[\s\S]*padding:\s*1\.25mm 1\.4mm\s*!important;[\s\S]*font-size:\s*7\.45pt\s*!important;/);
  });

  it('does not force an extra page break after each full-height A4 page during html2pdf export', () => {
    expect(css).toMatch(/\.pdf-export-active\.payslip-print-container\s+\.payslip-a4-page\s*{[^}]*page-break-after:\s*auto\s*!important;[^}]*break-after:\s*auto\s*!important;/);
    expect(css).not.toMatch(/\.pdf-export-active\.payslip-print-container\s+\.payslip-a4-page\s*{[^}]*page-break-after:\s*always\s*!important;[^}]*break-after:\s*page\s*!important;/);
  });
});
