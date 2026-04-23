import { describe, expect, it } from 'vitest';
import {
  buildEmployeePayrollBreakdown,
  toEmployeePayrollNumber,
} from './employeePayrollBreakdown';

describe('toEmployeePayrollNumber', () => {
  it('parses numeric strings and ignores invalid values', () => {
    expect(toEmployeePayrollNumber('15000')).toBe(15000);
    expect(toEmployeePayrollNumber(' 2,500 ')).toBe(2500);
    expect(toEmployeePayrollNumber('')).toBe(0);
    expect(toEmployeePayrollNumber('abc')).toBe(0);
  });
});

describe('buildEmployeePayrollBreakdown', () => {
  it('includes tunjangan, premi, and other incomes from mixed payload shapes', () => {
    const breakdown = buildEmployeePayrollBreakdown({
      beras_jumlah: '25000',
      jabatan_jumlah: 15000,
      tunjangan_khusus: '5000',
      premi_brondol: '12000',
      premi_details: [
        { normalized_key: 'premi_insentif', doc_desc: 'Insentif Panen', amount: '7000' },
      ],
      pendapatan_thr: '100000',
      other_incomes: [{ type: 'KONTAN', name: 'Kontan Mandor', amount: '20000' }],
      total_pendapatan_lainnya: '120000',
      total_premi: '19000',
      total_potongan: '140000',
      upah_bersih: '450000',
    });

    expect(breakdown.tunjanganList.map((item) => item.label)).toEqual([
      'Tunjangan Beras',
      'Tunjangan Jabatan',
      'Tunjangan Khusus',
    ]);
    expect(breakdown.premiList.map((item) => item.label)).toEqual([
      'Premi Brondol',
      'Premi Insentif Panen',
    ]);
    expect(breakdown.otherIncomeList.map((item) => item.label)).toEqual([
      'THR',
      'Kontan Mandor',
    ]);
    expect(breakdown.otherIncomeDeductionList).toHaveLength(2);
    expect(breakdown.totalOtherIncome).toBe(120000);
    expect(breakdown.totalPremi).toBe(19000);
    expect(breakdown.totalPotongan).toBe(140000);
    expect(breakdown.upahBersih).toBe(450000);
  });
});
