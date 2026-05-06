import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');

describe('Operational payslip print action', () => {
  it('passes current Daftar Upah display rows to the payslip print preview', () => {
    expect(source).toContain('buildPayslipEmployeeRowMap');
    expect(source).toContain('sessionStorage.setItem(dataKey');
    expect(source).toContain("params.set('data_key', dataKey)");
  });
});
