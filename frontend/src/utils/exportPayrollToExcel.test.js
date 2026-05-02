import { describe, expect, it } from 'vitest';
import {
  buildPayrollExportColumns,
  formatPayrollExportCellValue,
  resolvePayrollWorkbookSheetVariants,
} from './exportPayrollToExcel';

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

  it('builds a compact Ringkas version with core columns and other-income details', () => {
    const rows = [
      {
        type: 'employee',
        emp_code: 'A001',
        nama: 'Sari',
        pendapatan_thr: 500000,
        pendapatan_kontan: 125000,
        total_pendapatan_lainnya: 625000,
      },
    ];
    const columnDefs = [
      { field: 'emp_code', headers: ['IDENTITAS', null, null, 'EMP CODE'], w: 90 },
      { field: 'nama', headers: ['IDENTITAS', null, null, 'NAMA'], w: 120 },
      { field: 'status_ptkp', headers: ['PAJAK', null, null, 'PTKP'], w: 80 },
      { field: 'hari_kerja', headers: ['ABSENSI', null, null, 'HK'], w: 60 },
      { field: 'gaji_pokok', headers: ['GAJI POKOK', null, null, 'AKTUAL'], w: 90 },
      { field: 'beras_jumlah', headers: ['TUNJANGAN', null, null, 'BERAS'], w: 90 },
      { field: 'total_tunjangan', headers: ['TUNJANGAN', null, null, 'TOTAL'], w: 90 },
      { field: 'total_premi', headers: ['PREMI', null, null, 'TOTAL'], w: 90 },
      { field: 'total_pendapatan_lainnya', headers: ['PENDAPATAN LAINNYA', null, null, 'TOTAL (+)'], w: 100 },
      { field: 'pot_astek', headers: ['POTONGAN', null, null, 'ASTEK'], w: 90 },
      { field: 'pot_pph21', headers: ['POTONGAN', null, null, 'PPH21'], w: 90 },
      { field: 'total_potongan', headers: ['POTONGAN', null, null, 'TOTAL'], w: 90 },
      { field: 'upah_bersih', headers: ['UPAH BERSIH', null, null, 'TOTAL'], w: 110 },
    ];

    const fields = buildPayrollExportColumns(rows, columnDefs, { variant: 'summary' }).map((col) => col.field);

    expect(fields).toEqual([
      'emp_code',
      'nama',
      'hari_kerja',
      'gaji_pokok',
      'total_tunjangan',
      'total_premi',
      'pendapatan_thr',
      'pendapatan_kontan',
      'total_pendapatan_lainnya',
      'pot_pph21',
      'total_potongan',
      'upah_bersih',
    ]);
  });

  it('builds a Print report version with identity, payroll, all allowance and premium columns', () => {
    const rows = [
      {
        type: 'employee',
        emp_code: 'A001',
        nama: 'Sari (K2)',
        premi_pruning: 325000,
        pendapatan_thr: 500000,
        pendapatan_kontan: 125000,
        total_pendapatan_lainnya: 625000,
      },
    ];
    const columnDefs = [
      { field: 'no', headers: ['IDENTITAS', null, null, 'NO'], w: 35 },
      { field: 'emp_code', headers: ['IDENTITAS', null, null, 'EMP CODE'], w: 90 },
      { field: 'manual_adjustment_action', headers: ['IDENTITAS', null, null, 'MANUAL'], w: 72 },
      { field: 'nama', headers: ['IDENTITAS', null, null, 'NAMA'], w: 120 },
      { field: 'nik', headers: ['IDENTITAS', null, null, 'NIK'], w: 90 },
      { field: 'status_ptkp', headers: ['PAJAK', null, null, 'PTKP'], w: 80 },
      { field: 'gaji_pokok_aktual', headers: ['GAJI', null, null, 'GP AKTUAL'], w: 95 },
      { field: 'gaji_pokok_ideal', headers: ['GAJI', null, null, 'GP IDEAL'], w: 85 },
      { field: 'koreksi_hk', headers: ['GAJI', null, null, 'KOR. HK'], w: 85 },
      { field: 'beras_rate', headers: ['TUNJANGAN', 'BERAS', null, 'RATE'], w: 60 },
      { field: 'beras_jumlah', headers: ['TUNJANGAN', 'BERAS', null, 'JUMLAH'], w: 80 },
      { field: 'jabatan_jumlah', headers: ['TUNJANGAN', 'JABATAN', null, 'JUMLAH'], w: 80 },
      { field: 'masa_kerja_jumlah', headers: ['TUNJANGAN', 'MASA KERJA', null, 'JUMLAH'], w: 80 },
      { field: 'lembur_jumlah', headers: ['TUNJANGAN', 'LEMBUR', null, 'JUMLAH'], w: 80 },
      { field: 'total_tunjangan', headers: ['TUNJANGAN', null, null, 'TOTAL'], w: 95 },
      { field: 'premi_brondol', headers: ['PREMI', null, null, 'BRONDOL'], w: 80 },
      { field: 'premi_pruning', headers: ['PREMI', null, null, 'PRUNING'], w: 90 },
      { field: 'total_premi', headers: ['PREMI', null, null, 'TOTAL'], w: 95 },
      { field: 'total_pendapatan_lainnya', headers: ['PENDAPATAN LAINNYA', null, null, 'TOTAL (+)'], w: 100 },
      { field: 'jumlah_upah_kotor', headers: ['UPAH KOTOR', null, null, 'JUMLAH'], w: 118 },
      { field: 'pot_astek', headers: ['POTONGAN', null, null, 'ASTEK'], w: 75 },
      { field: 'pot_spsi', headers: ['POTONGAN', null, null, 'SPSI'], w: 86 },
      { field: 'pot_pph21', headers: ['POTONGAN', null, null, 'PPH21'], w: 86 },
      { field: 'premi_pph', headers: ['POTONGAN', null, null, 'PREMI PPH'], w: 90 },
      { field: 'total_potongan_bersih', headers: ['POTONGAN', null, null, 'TOTAL'], w: 100 },
      { field: 'upah_bersih', headers: ['UPAH BERSIH', null, null, 'JUMLAH'], w: 115 },
    ];

    const fields = buildPayrollExportColumns(rows, columnDefs, { variant: 'print' }).map((col) => col.field);

    expect(fields).toEqual([
      'emp_code',
      'nama',
      'gaji_pokok_aktual',
      'gaji_pokok_ideal',
      'koreksi_hk',
      'beras_jumlah',
      'jabatan_jumlah',
      'masa_kerja_jumlah',
      'lembur_jumlah',
      'total_tunjangan',
      'premi_brondol',
      'premi_pruning',
      'total_premi',
      'pendapatan_thr',
      'pendapatan_kontan',
      'total_pendapatan_lainnya',
      'jumlah_upah_kotor',
      'pot_astek',
      'pot_spsi',
      'pot_pph21',
      'total_potongan_bersih',
      'upah_bersih',
    ]);
  });

  it('cleans parenthesized employee name details for Print export cells', () => {
    const value = formatPayrollExportCellValue(
      { type: 'employee', nama: 'Sari   (K2 Mandor)  Lestari (OLD)' },
      { field: 'nama' },
      'print'
    );

    expect(value).toBe('Sari Lestari');
  });

  it('uses one workbook with Detail as the first sheet, then Ringkas and Print', () => {
    expect(resolvePayrollWorkbookSheetVariants()).toEqual(['detail', 'summary', 'print']);
  });
});
