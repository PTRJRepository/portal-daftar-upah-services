import { describe, expect, it } from 'vitest';
import { getDaftarUpahDownloadActionCopy } from './payrollDownloadAction';

describe('getDaftarUpahDownloadActionCopy', () => {
  it('names the payroll export as a Daftar Upah download action', () => {
    expect(getDaftarUpahDownloadActionCopy(false)).toEqual({
      label: 'Unduh File Daftar Upah',
      icon: '⬇️',
      title: 'Unduh file Daftar Upah sesuai data yang tampil sekarang',
    });
  });

  it('uses a download loading label while generating the file', () => {
    expect(getDaftarUpahDownloadActionCopy(true).label).toBe('Mengunduh...');
  });
});
