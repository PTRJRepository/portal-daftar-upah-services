import { describe, expect, it } from 'vitest';

async function loadPrintHelpers() {
  const mod = await import('./executivePayrollPrintReport.js').catch((error) => ({
    __importError: error.message
  }));

  expect(mod.__importError).toBeUndefined();
  return mod;
}

describe('executive payroll print report helpers', () => {
  it('builds division rows with payroll share and merged cost/HK data', async () => {
    const { buildExecutiveDivisionRows } = await loadPrintHelpers();

    const rows = buildExecutiveDivisionRows({
      breakdown: [
        { division_code: 'B', total_wage: 500, total_ot: 50, total_premi: 100, headcount: 5 },
        { division_code: 'A', total_wage: 1500, total_ot: 300, total_premi: 150, headcount: 10 }
      ],
      efficiency: [
        { division_code: 'A', total_man_days: 30 },
        { division_code: 'B', total_man_days: 10 }
      ]
    });

    expect(rows).toEqual([
      expect.objectContaining({
        divisionCode: 'A',
        totalWage: 1500,
        payrollShare: 75,
        overtimeShare: 20,
        premiShare: 10,
        costPerHk: 50
      }),
      expect.objectContaining({
        divisionCode: 'B',
        totalWage: 500,
        payrollShare: 25,
        overtimeShare: 10,
        premiShare: 20,
        costPerHk: 50
      })
    ]);
  });

  it('summarizes executive print insights from current and previous metrics', async () => {
    const { buildExecutivePrintSummary } = await loadPrintHelpers();

    const summary = buildExecutivePrintSummary({
      kpi: {
        curr_wage: 2000,
        prev_wage: 1600,
        curr_ot: 350,
        prev_ot: 300,
        curr_headcount: 20,
        prev_headcount: 18
      },
      breakdown: [
        { division_code: 'A', total_wage: 1200, total_ot: 120, total_premi: 60, headcount: 12 },
        { division_code: 'B', total_wage: 800, total_ot: 220, total_premi: 40, headcount: 8 }
      ],
      efficiency: [
        { division_code: 'A', total_cost: 1200, total_man_days: 40, headcount: 12 },
        { division_code: 'B', total_cost: 800, total_man_days: 10, headcount: 8 }
      ],
      productivityTrend: [
        { period: 'Apr 2026', costPerHk: 42, totalHk: 50 },
        { period: 'Mei 2026', costPerHk: 80, totalHk: 25 }
      ],
      wageSpikes: [{ id: 'G1', percentage: 30 }]
    });

    expect(summary).toMatchObject({
      totalWage: 2000,
      wageChange: 25,
      totalOvertime: 350,
      overtimeShare: 17.5,
      overtimeChange: 16.7,
      headcount: 20,
      headcountChange: 11.1,
      latestCostPerHk: 80,
      alertCount: 1,
      largestPayrollDivision: expect.objectContaining({ divisionCode: 'A', payrollShare: 60 }),
      largestOvertimeDivision: expect.objectContaining({ divisionCode: 'B', overtimeShare: 27.5 }),
      highestCostPerHkDivision: expect.objectContaining({ divisionCode: 'B', costPerHk: 80 })
    });
  });

  it('builds the last 12 trend rows and merges productivity cost/HK by period', async () => {
    const { buildExecutiveTrendRows } = await loadPrintHelpers();

    const trends = Array.from({ length: 13 }, (_, index) => ({
      period: `P${index + 1}`,
      total_wage: (index + 1) * 100,
      total_ot: (index + 1) * 10,
      total_hk: index + 1
    }));

    const rows = buildExecutiveTrendRows({
      trends,
      productivityTrend: [
        { period: 'P2', costPerHk: 2000 },
        { period: 'P13', costPerHk: 1300 }
      ]
    });

    expect(rows).toHaveLength(12);
    expect(rows[0]).toMatchObject({ period: 'P2', totalWage: 200, costPerHk: 2000 });
    expect(rows[11]).toMatchObject({ period: 'P13', totalWage: 1300, overtimeShare: 10, costPerHk: 1300 });
  });

  it('normalizes and limits print alert rows by largest percentage increase', async () => {
    const { buildExecutiveAlertRows } = await loadPrintHelpers();

    const rows = buildExecutiveAlertRows([
      { id: 'G1', name: 'Gang 1', percentage: 20, currentWage: 120000, difference: 10000 },
      { id: 'G2', name: 'Gang 2', percentage: 55, currentWage: 150000, difference: 30000 },
      { id: 'G3', name: 'Gang 3', percentage: 10, currentWage: 90000, difference: 5000 },
      { id: 'G4', name: 'Gang 4', percentage: 25, currentWage: 110000, difference: 8000 },
      { id: 'G5', name: 'Gang 5', percentage: 18, currentWage: 100000, difference: 6000 },
      { id: 'G6', name: 'Gang 6', percentage: 35, currentWage: 130000, difference: 12000 }
    ]);

    expect(rows.map((row) => row.gangCode)).toEqual(['G2', 'G6', 'G4', 'G1', 'G5']);
    expect(rows[0]).toMatchObject({
      gangCode: 'G2',
      label: 'Gang 2',
      increasePercent: 55,
      currentCostPerHk: 150000,
      difference: 30000
    });
  });
});
