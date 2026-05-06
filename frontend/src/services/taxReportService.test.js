/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { downloadMonthlyTaxReportExcelFromDOM, fetchMonthlyTaxReport } from './taxReportService';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('taxReportService', () => {
  beforeEach(() => {
    axios.get.mockReset();
    axios.post.mockReset();
    axios.get.mockResolvedValue({ data: { employees: [] } });
    axios.post.mockResolvedValue({
      status: 200,
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      },
      data: new Blob(['excel'])
    });
    Object.defineProperty(window.URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:tax-report')
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn()
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('sends value priority mode for monthly tax reports', async () => {
    await fetchMonthlyTaxReport(
      'token',
      2026,
      3,
      'PG1A',
      'A1H',
      '1',
      true,
      4,
      'db_ptrj_only'
    );

    expect(axios.get).toHaveBeenCalledWith('tax-report/monthly', {
      params: expect.objectContaining({
        year: 2026,
        month: 3,
        division: 'PG1A',
        gang: 'A1H',
        gangPrefix: '1',
        use_history: 'true',
        value_priority_mode: 'db_ptrj_only'
      }),
      headers: { Authorization: 'Bearer token' },
      timeout: 300000
    });
  });

  it('posts a compact DOM tax export payload without heavy table metadata', async () => {
    await downloadMonthlyTaxReportExcelFromDOM(
      'token',
      2026,
      4,
      'AB1',
      'A1H',
      '',
      [
        {
          type: 'employee',
          emp_code: 'A0001',
          nik: '123',
          new_nik: '456',
          nama: 'Siti',
          gang_code: 'A1H',
          upah_dasar: 100000,
          total_premi: 50000,
          premi: { pruning: 30000, brondol: 20000 },
          premi_pruning: 30000,
          premi_brondol: 20000,
          pph21_ter: 7500,
          penghasilan_bruto: 150000,
          lembur_records: Array.from({ length: 20 }, (_, id) => ({ id, notes: 'detail berat' })),
          shortage_details: [{ date: '2026-04-01' }],
          manual_adjustment_metadata: { premi_pruning: { items: [{ subblok: 'A/1', jumlah: 1 }] } },
          value_source_compare: { total_premi: { active: 50000, db_ptrj: 49000 } }
        }
      ],
      ['premi_pruning']
    );

    const [, payload] = axios.post.mock.calls[0];
    expect(payload.employees).toHaveLength(1);
    expect(payload.employees[0]).toMatchObject({
      emp_code: 'A0001',
      nik: '123',
      new_nik: '456',
      nama: 'Siti',
      gang_code: 'A1H',
      total_premi: 50000,
      premi_pruning: 30000,
      premi_brondol: 20000,
      pph21_ter: 7500,
      penghasilan_bruto: 150000
    });
    expect(payload.employees[0].premi).toEqual({ pruning: 30000, brondol: 20000 });
    expect(payload.employees[0]).not.toHaveProperty('lembur_records');
    expect(payload.employees[0]).not.toHaveProperty('shortage_details');
    expect(payload.employees[0]).not.toHaveProperty('manual_adjustment_metadata');
    expect(payload.employees[0]).not.toHaveProperty('value_source_compare');
  });
});
