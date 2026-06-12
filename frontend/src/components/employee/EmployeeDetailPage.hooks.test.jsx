/** @vitest-environment jsdom */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
const { act } = React;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token' }),
}));

const getEmployeeCheckrollMock = vi.fn();
const getEmployeeHistoryMock = vi.fn();

vi.mock('../../services/employeeDetailService', () => ({
  getEmployeeCheckroll: (...args) => getEmployeeCheckrollMock(...args),
  getEmployeeHistory: (...args) => getEmployeeHistoryMock(...args),
}));

vi.mock('../common/LoadingScreen', () => ({
  default: ({ message }) => React.createElement('div', null, message),
}));

vi.mock('./ThumbprintVerification', () => ({
  default: () => React.createElement('div', null, 'thumb'),
}));

vi.mock('./EmployeeTrendsCharts', () => ({
  EmployeeTrendsCharts: () => React.createElement('div', null, 'trends'),
}));

import EmployeeDetailPage from './EmployeeDetailPage';

describe('EmployeeDetailPage hook stability', () => {
  it('renders from loading to loaded state without hook-order crash', async () => {
    getEmployeeHistoryMock.mockResolvedValue({ data: [] });
    getEmployeeCheckrollMock.mockResolvedValueOnce({
      employee: { nama: 'Tester', actual_nik: '123', gang_code: 'A1' },
      payroll_data: {
        emp_code: 'B001',
        gaji_pokok: 100000,
        upah_bersih: 95000,
      },
      attendance: { summary: {}, list: [] },
      overtime: { summary: {}, list: [] },
      harvest: [],
    });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <EmployeeDetailPage
          employeeData={{ emp_code: 'B001' }}
          month={4}
          year={2026}
          division="PG2B"
          onBack={() => {}}
        />
      );
    });

    expect(container.textContent).toContain('SLIP GAJI KARYAWAN');

    await act(async () => {
      root.unmount();
    });
  });

  it('shows overtime formula details with UPJ explanation and per-transaction breakdown', async () => {
    getEmployeeHistoryMock.mockResolvedValue({ data: [] });
    getEmployeeCheckrollMock.mockResolvedValueOnce({
      employee: { nama: 'Tester', actual_nik: '123', gang_code: 'A1' },
      payroll_data: {
        emp_code: 'B001',
        gaji_pokok: 100000,
        upah_bersih: 95000,
      },
      attendance: { summary: {}, list: [] },
      overtime: {
        summary: { total_hours: 3 },
        matrix: {},
        list: [{
          date: '2026-04-03',
          day_name: 'Jumat',
          day_type: 'Hari Kerja Pendek',
          raw_day_type: 'WORKDAY_SHORT',
          task_code: 'PANEN',
          hours: 3,
          amount_formula: 155313,
          upj_value: 34514,
          formula_uraian: '1 jam @ 1.5x + 2 jam @ 2x'
        }]
      },
      harvest: [],
    });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <EmployeeDetailPage
          employeeData={{ emp_code: 'B001' }}
          month={4}
          year={2026}
          division="PG2B"
          onBack={() => {}}
        />
      );
    });

    expect(container.textContent).toContain('UPJ (Upah Per Jam)')
    expect(container.textContent).toContain('1 jam @ 1.5x + 2 jam @ 2x')
    expect(container.textContent).toContain('Rumus')
    expect(container.textContent).toContain('Mode Ringkas')
    expect(container.textContent).toContain('Mode Detail')

    await act(async () => {
      root.unmount();
    });
  });

  it('passes history db and snapshot options to checkroll fetch', async () => {
    getEmployeeCheckrollMock.mockClear();
    getEmployeeHistoryMock.mockResolvedValue({ data: [] });
    getEmployeeCheckrollMock.mockResolvedValueOnce({
      employee: { nama: 'Tester', actual_nik: '123', gang_code: 'A1' },
      payroll_data: {
        emp_code: 'B001',
        gaji_pokok: 100000,
        upah_bersih: 95000,
      },
      attendance: { summary: {}, list: [] },
      overtime: { summary: {}, list: [] },
      harvest: [],
    });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <EmployeeDetailPage
          employeeData={{ emp_code: 'B001' }}
          month={4}
          year={2026}
          division="INFRA"
          useHistoryDb={true}
          snapshotVersion={7}
          onBack={() => {}}
        />
      );
    });

    expect(getEmployeeCheckrollMock).toHaveBeenCalledWith(
      'test-token',
      'B001',
      4,
      2026,
      'INFRA',
      true,
      7
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('does not refetch salary history when toggling local detail controls', async () => {
    getEmployeeHistoryMock.mockClear();
    getEmployeeHistoryMock.mockResolvedValue({ data: [] });
    getEmployeeCheckrollMock.mockResolvedValueOnce({
      employee: { nama: 'Tester', actual_nik: '123', gang_code: 'A1' },
      payroll_data: {
        emp_code: 'B001',
        gaji_pokok: 100000,
        upah_bersih: 95000,
      },
      attendance: { summary: {}, list: [] },
      overtime: {
        summary: { total_hours: 3 },
        matrix: {},
        list: [{
          date: '2026-04-03',
          day_name: 'Jumat',
          day_type: 'Hari Kerja Pendek',
          raw_day_type: 'WORKDAY_SHORT',
          task_code: 'PANEN',
          hours: 3,
          amount_formula: 155313,
          upj_value: 34514,
          formula_uraian: '1 jam @ 1.5x + 2 jam @ 2x'
        }]
      },
      harvest: [],
    });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <EmployeeDetailPage
          employeeData={{ emp_code: 'B001' }}
          month={4}
          year={2026}
          division="PG2B"
          onBack={() => {}}
        />
      );
    });

    expect(getEmployeeHistoryMock).toHaveBeenCalledTimes(1);

    const compactButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Mode Ringkas'));

    await act(async () => {
      compactButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(getEmployeeHistoryMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('renders payroll deductions from magnitudes and keeps ASTEK worker-only in employee detail', async () => {
    getEmployeeHistoryMock.mockResolvedValue({ data: [] });
    getEmployeeCheckrollMock.mockResolvedValueOnce({
      employee: { nama: 'Tester', actual_nik: '123', gang_code: 'A1' },
      payroll_data: {
        emp_code: 'B001',
        jumlah_hk: 20,
        upah_dasar: 100000,
        gaji_pokok: 2000000,
        total_premi: 100000,
        premi_panen: 100000,
        premi_pph: 20000,
        pot_koreksi: -10000,
        koreksi_denda_panen: -5000,
        pot_astek_pekerja: 30000,
        pot_astek_majikan: 40000,
        pot_astek_jumlah: 70000,
        pot_spsi: -2000,
        total_potongan: 0,
        jumlah_upah_kotor: 2090000,
        upah_bersih: 2078000,
      },
      attendance: { summary: {}, list: [] },
      overtime: { summary: {}, list: [] },
      harvest: [],
    });

    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <EmployeeDetailPage
          employeeData={{ emp_code: 'B001' }}
          month={4}
          year={2026}
          division="PG2B"
          onBack={() => {}}
        />
      );
    });

    expect(container.textContent).toContain('Koreksi DENDA PANEN');
    expect(container.textContent).toContain('10.000');
    expect(container.textContent).toContain('5.000');
    expect(container.textContent).toContain('Astek Pekerja');
    expect(container.textContent).toContain('30.000');
    expect(container.textContent).not.toContain('70.000');
    expect(container.textContent).not.toContain('Premi PPH');

    await act(async () => {
      root.unmount();
    });
  });
});
