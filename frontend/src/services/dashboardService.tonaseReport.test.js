import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { fetchTonaseAnalysisReport } from './dashboardService';

vi.mock('axios', () => ({
  default: {
    get: vi.fn()
  }
}));

describe('dashboardService tonase analysis report', () => {
  beforeEach(() => {
    axios.get.mockReset();
    axios.get.mockResolvedValue({ data: { success: true, data: { kpis: {} } } });
  });

  it('fetches the tonase report endpoint with selected month and year', async () => {
    const result = await fetchTonaseAnalysisReport('token-1', { month: 5, year: 2026 });

    expect(axios.get).toHaveBeenCalledWith('payroll/dashboard/tonase-analysis-report', {
      params: {
        month: '5',
        year: '2026',
        division_code: 'REBINMAS'
      },
      headers: {
        Authorization: 'Bearer token-1',
        'Content-Type': 'application/json'
      }
    });
    expect(result).toEqual({ success: true, data: { kpis: {} } });
  });

  it('passes a division scope only when one is selected', async () => {
    await fetchTonaseAnalysisReport('token-1', { month: 5, year: 2026, division_code: 'IJL' });

    expect(axios.get).toHaveBeenCalledWith('payroll/dashboard/tonase-analysis-report', {
      params: {
        month: '5',
        year: '2026',
        division_code: 'IJL'
      },
      headers: {
        Authorization: 'Bearer token-1',
        'Content-Type': 'application/json'
      }
    });
  });
});
