import { describe, expect, it } from 'vitest';
import { PayrollAggregator } from './PayrollAggregator';

describe('PayrollAggregator totals', () => {
  it('does not total automatic koreksi HK because it is display-only', () => {
    const totals = PayrollAggregator.calculateGrandTotal([
      { type: 'employee', jumlah_hk: 24, koreksi_hk: -100000 },
      { type: 'employee', jumlah_hk: 23, koreksi_hk: 25000 },
    ]);

    expect(totals.jumlah_hk).toBe(47);
    expect(totals.koreksi_hk).toBeUndefined();
  });

  it('filters active employees by jumlah_hk to match backend payroll totals', () => {
    const rows = PayrollAggregator.flattenData({
      gangs: [
        {
          gang_code: 'A1',
          employees: [
            { nama: 'Included', jumlah_hk: 1, hari_kerja: 0, gaji_pokok: 100000 },
            { nama: 'Excluded', jumlah_hk: 0, hari_kerja: 1, gaji_pokok: 999999 },
          ],
        },
      ],
    });

    expect(rows.map((row) => row.nama)).toEqual(['Included']);
  });

  it('does not show automatic HK correction as potongan upah kotor', () => {
    const row = PayrollAggregator.calculateEmployeeFields({
      jumlah_hk: 24,
      gaji_pokok_aktual: 900_000,
      koreksi_hk: -100_000,
      pot_koreksi: 100_000,
      potongan_upah_kotor_total: 100_000,
      jumlah_upah_kotor: 900_000,
    });

    expect(row.potongan_upah_kotor_total).toBe(0);
    expect(row.jumlah_upah_kotor).toBe(900_000);
  });
});
