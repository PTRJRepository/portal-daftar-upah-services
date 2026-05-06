import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./PayslipPrintPage.jsx', import.meta.url), 'utf8');

describe('PayslipPrintPage eight-slip print layout', () => {
  it('chunks payslips into eight cards per A4 portrait page and labels print guidance accordingly', () => {
    expect(source).toContain('Layout: 8 payslips per A4 page');
    expect(source).toContain('const payslipChunks = chunkArray(payslipData, 8);');
    expect(source).toContain('agar 8 slip muat di 1 halaman A4');
    expect(source).toContain('payslip-cut-line--quarter');
    expect(source).toContain('payslip-cut-line--half');
    expect(source).toContain('payslip-cut-line--three-quarter');
  });

  it('prefers current Daftar Upah data passed by data_key before falling back to API data', () => {
    expect(source).toContain('sessionStorage.getItem(dataKey) || localStorage.getItem(dataKey)');
    expect(source).toContain('const employeeDataMap = parsedData?.data');
    expect(source).toContain('Using fast sessionStorage data from UI');
  });

  it('exports payslip PDF with CSS page breaks instead of avoid-all pagination', () => {
    expect(source).toContain("jsPDF: { orientation: 'portrait' }");
    expect(source).toContain("pagebreak: { mode: ['css', 'legacy'], avoid: ['.payslip-card'] }");
  });
});
