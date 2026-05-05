import { describe, expect, it } from 'vitest';
import {
  buildHighEarnerRows,
  buildSalaryRangeRows,
  normalizeDivisionOptions,
  normalizeGangOptions,
} from './payrollReportFilters';

const rows = [
  {
    nama: 'Andi',
    upah_bersih: 7000000,
    gang_code: 'AB1A',
    loc_code: 'AB1',
    gaji_pokok: 3000000,
    total_tunjangan: 1000000,
    lembur_jumlah: 250000,
    total_premi: 500000,
    total_potongan_bersih: 150000,
  },
  {
    nama: 'Budi',
    upah_bersih: '8200000',
    gang_code: 'AB1B',
    loc_code: 'AB1',
    gaji_pokok_aktual: 3500000,
    total_tunjangan: 900000,
    lembur_jumlah: 0,
    total_premi: 1200000,
    total_potongan_bersih: 200000,
  },
  {
    nama: 'Cici',
    upah_bersih: 5900000,
    gang_code: 'P1A1',
    loc_code: 'P1A',
    gaji_pokok: 2800000,
  },
  {
    nama: 'Dedi',
    upah_bersih: 7100000,
    gang_code: 'P1A2',
    divisi: 'P1A',
    gaji_pokok_aktual: 3200000,
    jabatan_jumlah: 300000,
    beras_jumlah: 150000,
    masa_kerja_jumlah: 200000,
    lembur_jumlah: 100000,
    total_potongan_bersih: 175000,
  },
];

describe('buildHighEarnerRows', () => {
  it('filters by limit and division, then ranks by upah bersih descending', () => {
    const report = buildHighEarnerRows(rows, { limit: 6000000, division: 'AB1' });

    expect(report.data.map((row) => row.nama)).toEqual(['Budi', 'Andi']);
    expect(report.data.map((row) => row.rank)).toEqual([1, 2]);
    expect(report.meta).toMatchObject({
      count: 2,
      limit: 6000000,
      sum_upah_bersih: 15200000,
      max_upah_bersih: 8200000,
    });
  });

  it('can narrow rows by selected gang after the payroll report fetch', () => {
    const report = buildHighEarnerRows(rows, { limit: 6000000, gang: 'P1A2' });

    expect(report.data.map((row) => row.nama)).toEqual(['Dedi']);
    expect(report.meta.count).toBe(1);
  });
});

describe('buildSalaryRangeRows', () => {
  it('filters by salary range, ranks descending, and totals print footer fields', () => {
    const report = buildSalaryRangeRows(rows, { minSalary: 6000000, maxSalary: 7500000 });

    expect(report.data.map((row) => row.nama)).toEqual(['Dedi', 'Andi']);
    expect(report.data.map((row) => row.rank)).toEqual([1, 2]);
    expect(report.meta).toMatchObject({
      count: 2,
      min_salary: 6000000,
      max_salary: 7500000,
      sum_upah_bersih: 14100000,
      sum_gaji_pokok: 6200000,
      sum_lembur: 350000,
      sum_potongan: 325000,
      sum_jabatan: 300000,
      sum_beras: 150000,
      sum_masa_kerja: 200000,
    });
  });
});

describe('report option normalizers', () => {
  it('normalizes division and gang responses from array or object payloads', () => {
    expect(normalizeDivisionOptions({ data: ['AB1', { code: 'P1A' }, { division_code: 'IJL', name: 'IJL Estate' }] })).toEqual([
      { code: 'AB1', label: 'AB1' },
      { code: 'P1A', label: 'P1A' },
      { code: 'IJL', label: 'IJL Estate' },
    ]);

    expect(normalizeGangOptions([{ gang_code: 'AB1A', description: 'Panen' }, 'P1A2'])).toEqual([
      { code: 'AB1A', label: 'AB1A - Panen' },
      { code: 'P1A2', label: 'P1A2' },
    ]);
  });
});
