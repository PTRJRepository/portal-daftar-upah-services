import { describe, expect, it } from 'vitest';
import { buildPayrollExportColumns } from './exportPayrollToExcel';

describe('buildPayrollExportColumns', () => {
  it('uses portal columns without appending raw row fields', () => {
    const rows = [
      {
        type: 'employee',
        nama: 'Sari',
        pot_pph21: 12000,
        pph21_ter: 18000,
        status_ptkp: 'K/1',
        manual_adjustment_metadata: { premi_pruning: { source: 'manual_adjustment' } },
      },
    ];
    const columnDefs = [
      { field: 'nama', headers: ['IDENTITAS', null, null, 'NAMA'], w: 120 },
      { field: 'pot_pph21', headers: ['POTONGAN', null, null, 'PPH21'], w: 90 },
    ];

    const fields = buildPayrollExportColumns(rows, columnDefs).map((col) => col.field);

    expect(fields).toEqual(['nama', 'pot_pph21']);
  });

  it('removes tax detail columns but keeps the actual PPH21 deduction', () => {
    const columnDefs = [
      { field: 'status_ptkp', headers: ['PAJAK', null, null, 'PTKP'], w: 80 },
      { field: 'kategori_ter', headers: ['PAJAK', null, null, 'TER'], w: 55 },
      { field: 'penghasilan_bruto', headers: ['PAJAK', null, null, 'BRUTO'], w: 110 },
      { field: 'tarif_pajak_ter', headers: ['PAJAK', null, null, 'TER (%)'], w: 80 },
      { field: 'pph21_ter', headers: ['PAJAK', null, null, 'PPH21 TER'], w: 95 },
      { field: 'premi_pph', headers: ['POTONGAN', null, null, 'PREMI PPH (+)'], w: 90 },
      { field: 'taxable_pendapatan_lainnya', headers: ['PAJAK', 'OBJEK', null, 'TOTAL'], w: 85 },
      { field: 'pot_pph21', headers: ['POTONGAN', null, null, 'PPH21'], w: 90 },
      { field: 'upah_bersih', headers: ['UPAH BERSIH', null, null, 'TOTAL'], w: 110 },
    ];

    const fields = buildPayrollExportColumns([], columnDefs).map((col) => col.field);

    expect(fields).toEqual(['pot_pph21', 'upah_bersih']);
  });

  it('adds controlled other-income detail columns before the total column', () => {
    const rows = [
      {
        type: 'employee',
        nama: 'Sari',
        pendapatan_thr: 500000,
        pendapatan_kontan: 125000,
        total_pendapatan_lainnya: 625000,
        taxable_pendapatan_thr: 500000,
      },
    ];
    const columnDefs = [
      { field: 'nama', headers: ['IDENTITAS', null, null, 'NAMA'], w: 120 },
      { field: 'total_pendapatan_lainnya', headers: ['PENDAPATAN LAINNYA', null, null, 'TOTAL (+)'], w: 100 },
      { field: 'upah_bersih', headers: ['UPAH BERSIH', null, null, 'TOTAL'], w: 110 },
    ];

    const columns = buildPayrollExportColumns(rows, columnDefs);

    expect(columns.map((col) => col.field)).toEqual([
      'nama',
      'pendapatan_thr',
      'pendapatan_kontan',
      'total_pendapatan_lainnya',
      'upah_bersih',
    ]);
    expect(columns.find((col) => col.field === 'pendapatan_thr')?.headers).toEqual([
      'PENDAPATAN LAINNYA',
      'URAIAN',
      null,
      'THR (+)',
    ]);
    expect(columns.find((col) => col.field === 'pendapatan_kontan')?.headers[3]).toBe('KONTANAN (+)');
  });
});
