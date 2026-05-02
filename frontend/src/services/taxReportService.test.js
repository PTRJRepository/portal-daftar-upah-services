import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { fetchMonthlyTaxReport } from './taxReportService';

vi.mock('axios', () => ({
  default: {
    get: vi.fn()
  }
}));

describe('taxReportService', () => {
  beforeEach(() => {
    axios.get.mockReset();
    axios.get.mockResolvedValue({ data: { employees: [] } });
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
});
