import { describe, expect, it } from 'vitest';
import { getDaftarUpahDownloadActionCopy } from './payrollDownloadAction';

describe('getDaftarUpahDownloadActionCopy', () => {
  it('names the payroll export as one combined Daftar Upah download action', () => {
    expect(getDaftarUpahDownloadActionCopy(false)).toEqual({
      label: 'Unduh Daftar Upah',
      icon: 'XLS',
      title: 'Unduh file Daftar Upah dengan sheet Detail, Ringkas, dan Print',
      variantLabel: 'Workbook',
    });
  });

  it('uses a download loading label while generating the file', () => {
    expect(getDaftarUpahDownloadActionCopy(true).label).toBe('Mengunduh Daftar Upah...');
  });
});
