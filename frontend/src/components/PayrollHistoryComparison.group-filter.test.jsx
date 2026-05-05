/** @vitest-environment jsdom */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

const { act } = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocked = vi.hoisted(() => ({
  fetchWagesComparison: vi.fn(),
  fetchAvailableWagesPeriods: vi.fn(() => Promise.resolve({ data: [] })),
  fetchDivisions: vi.fn(() => Promise.resolve(['PG1A'])),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token' }),
}));

vi.mock('../services/gangService', () => ({
  fetchDivisions: mocked.fetchDivisions,
}));

vi.mock('./common/PrintSignature', () => ({
  default: () => null,
}));

vi.mock('../services/wagesService', () => ({
  fetchWagesComparison: mocked.fetchWagesComparison,
  fetchAvailableWagesPeriods: mocked.fetchAvailableWagesPeriods,
  formatCurrency: (value) => value == null ? '-' : `Rp${value}`,
  formatNumber: (value) => value == null ? '-' : String(value),
  getMonthName: (month) => `Bulan ${month}`,
  getStatusBadge: () => ({ bgColor: '#fff', color: '#111', icon: '', label: 'Cocok' }),
}));

import PayrollHistoryComparison from './PayrollHistoryComparison';

async function flushEffects() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function buildComparisonRow({ empCode, name, gangCode }) {
  return {
    emp_code: empCode,
    nik: `${empCode}-NIK`,
    nama: name,
    gang_code: gangCode,
    division_code: 'PG1A',
    daftar_upah: {
      jumlah_hk: 1,
      tonase: 0,
      gaji_pokok: 100,
      total_tunjangan: 0,
      total_premi: 0,
      total_potongan: 0,
      upah_bersih: 100,
    },
    wages: {
      jumlah_hk: 1,
      upah_bersih: 100,
      wages_no: `W-${empCode}`,
    },
    comparison: {
      status: 'MATCH',
      hk_difference: 0,
      amount_difference: 0,
    },
  };
}

function findSelectByLabel(container, labelText) {
  const groups = Array.from(container.querySelectorAll('.phc-filter-group'));
  const group = groups.find((node) => (node.textContent || '').includes(labelText));
  return group?.querySelector('select');
}

describe('PayrollHistoryComparison group filter', () => {
  beforeEach(() => {
    mocked.fetchWagesComparison.mockReset();
    mocked.fetchAvailableWagesPeriods.mockClear();
    mocked.fetchDivisions.mockClear();
    mocked.fetchWagesComparison.mockResolvedValue({
      data: [
        buildComparisonRow({ empCode: 'E001', name: 'Budi Group Satu', gangCode: 'A1H' }),
        buildComparisonRow({ empCode: 'E002', name: 'Cici Group Dua', gangCode: 'A2H' }),
      ],
      summary: {
        total_employees: 2,
        matched: 2,
        minor_differences: 0,
        major_differences: 0,
        no_wages_data: 0,
        total_variance: 0,
      },
    });
  });

  it('recomputes visible rows when the group filter changes', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <PayrollHistoryComparison
            initialMonth={4}
            initialYear={2026}
            initialDivision="PG1A"
          />
        );
      });
      await flushEffects();

      expect(container.textContent || '').toContain('Budi Group Satu');
      expect(container.textContent || '').toContain('Cici Group Dua');

      const groupSelect = findSelectByLabel(container, 'Group');
      expect(groupSelect).toBeTruthy();

      await act(async () => {
        groupSelect.value = '2';
        groupSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await flushEffects();

      expect(container.textContent || '').not.toContain('Budi Group Satu');
      expect(container.textContent || '').toContain('Cici Group Dua');
      expect(container.textContent || '').toContain('Menampilkan 1 dari 2 data');
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });
});
