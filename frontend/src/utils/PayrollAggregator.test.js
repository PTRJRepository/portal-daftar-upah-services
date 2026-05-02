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
});
