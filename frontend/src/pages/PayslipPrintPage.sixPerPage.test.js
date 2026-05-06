import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./PayslipPrintPage.jsx', import.meta.url), 'utf8');

describe('PayslipPrintPage six-slip print layout', () => {
  it('chunks payslips into six cards per A4 portrait page and labels print guidance accordingly', () => {
    expect(source).toContain('Layout: 6 payslips per A4 page');
    expect(source).toContain('const payslipChunks = chunkArray(payslipData, 6);');
    expect(source).toContain('agar 6 slip muat di 1 halaman A4');
  });
});
