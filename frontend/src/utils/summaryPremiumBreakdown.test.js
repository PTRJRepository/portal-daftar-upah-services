import { describe, expect, it } from 'vitest';
import {
  buildSummaryPremiumBreakdown,
  getSummaryRowPremiumDoubleCount,
  getSummaryRowPremiumItems,
} from './summaryPremiumBreakdown';

describe('summaryPremiumBreakdown', () => {
  it('aggregates dynamic premi headers and reconciles the remaining total premi', () => {
    const rows = [
      {
        gang_code: 'A1H',
        total_premi: 175000,
        _dynamic_premi_list: [
          { header: 'PREMI BRONDOL', total: 100000 },
          { header: 'PREMI PRUNING', total: 25000 },
        ],
      },
      {
        gang_code: 'A2H',
        total_premi: 75000,
        _dynamic_premi_list: [
          { header: 'PREMI BRONDOL', total: 50000 },
          { header: 'PREMI PRUNING', total: 25000 },
        ],
      },
    ];

    const result = buildSummaryPremiumBreakdown(rows, ['PREMI BRONDOL', 'PREMI PRUNING']);

    expect(result.grandTotal).toBe(250000);
    expect(result.classifiedTotal).toBe(200000);
    expect(result.residualTotal).toBe(50000);
    expect(result.breakdownTotal).toBe(result.grandTotal);
    expect(result.isReconciled).toBe(true);
    expect(result.items).toEqual([
      {
        header: 'PREMI BRONDOL',
        total: 150000,
        gangCount: 2,
        percentOfTotal: 60,
        isResidual: false,
      },
      {
        header: 'PREMI LAINNYA / SELISIH TOTAL',
        total: 50000,
        gangCount: 1,
        percentOfTotal: 20,
        isResidual: true,
      },
      {
        header: 'PREMI PRUNING',
        total: 50000,
        gangCount: 2,
        percentOfTotal: 20,
        isResidual: false,
      },
    ]);
  });

  it('builds row-level premium items for the total premi detail modal', () => {
    const row = {
      gang_code: 'B1H',
      total_premi: 140000,
      _dynamic_premi_list: [
        { header: 'PREMI BRONDOL', total: 90000 },
        { header: 'PREMI BRONDOL', total: 10000 },
        { header: 'PREMI KINERJA', total: 25000 },
      ],
    };

    const items = getSummaryRowPremiumItems(row, ['PREMI BRONDOL', 'PREMI KINERJA']);

    expect(items.reduce((sum, item) => sum + item.total, 0)).toBe(row.total_premi);
    expect(items).toEqual([
      { header: 'PREMI BRONDOL', total: 100000, percentOfTotal: 71.43, isResidual: false },
      { header: 'PREMI KINERJA', total: 25000, percentOfTotal: 17.86, isResidual: false },
      { header: 'PREMI LAINNYA / SELISIH TOTAL', total: 15000, percentOfTotal: 10.71, isResidual: true },
    ]);
  });

  it('identifies residual that repeats non-brondol premium items as double count candidates', () => {
    const row = {
      gang_code: 'A1H',
      total_premi: 153625076,
      _dynamic_premi_list: [
        { header: 'BRONDOL', total: 11340000 },
        { header: 'PREMI PRUNING', total: 45385850 },
        { header: 'PREMI CIRCLE RAKING', total: 15408000 },
        { header: 'PREMI TBS', total: 4065691 },
        { header: 'PREMI KINERJA', total: 2359545 },
        { header: 'PREMI TIKET', total: 2192107 },
        { header: 'PREMI INSENTIF PANEN', total: 1584350 },
        { header: 'PREMI ANGKUT', total: 146995 },
      ],
    };

    const doubleCount = getSummaryRowPremiumDoubleCount(row, [
      'BRONDOL',
      'PREMI PRUNING',
      'PREMI CIRCLE RAKING',
      'PREMI TBS',
      'PREMI KINERJA',
      'PREMI TIKET',
      'PREMI INSENTIF PANEN',
      'PREMI ANGKUT',
    ]);

    expect(doubleCount).toMatchObject({
      isDetected: true,
      reason: 'Residual sama dengan total dynamic premi non-brondol',
      residualTotal: 71142538,
    });
    expect(doubleCount.items.map((item) => item.header)).toEqual([
      'PREMI PRUNING',
      'PREMI CIRCLE RAKING',
      'PREMI TBS',
      'PREMI KINERJA',
      'PREMI TIKET',
      'PREMI INSENTIF PANEN',
      'PREMI ANGKUT',
    ]);
    expect(doubleCount.items.reduce((sum, item) => sum + item.total, 0)).toBe(71142538);
  });

  it('aggregates detected double-count candidates into the premium breakdown report', () => {
    const result = buildSummaryPremiumBreakdown([
      {
        gang_code: 'A1T',
        total_premi: 5533340,
        _dynamic_premi_list: [{ header: 'PREMI ANGKUT', total: 2766670 }],
      },
    ], ['PREMI ANGKUT']);

    expect(result.doubleCountTotal).toBe(2766670);
    expect(result.doubleCountItems).toEqual([
      {
        header: 'PREMI ANGKUT',
        total: 2766670,
        gangCount: 1,
        percentOfTotal: 50,
      },
    ]);
  });
});
