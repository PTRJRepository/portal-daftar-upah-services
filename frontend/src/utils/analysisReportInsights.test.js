import { describe, expect, it } from 'vitest';
import { buildAnalysisReportInsights } from './analysisReportInsights';

describe('buildAnalysisReportInsights', () => {
  const rows = [
    {
      division_code: 'A',
      description: 'Estate A',
      prev_premi: 100,
      curr_premi: 300,
      diff_premi: 200,
      prev_ot: 30,
      curr_ot: 160,
      diff_ot: 130,
      premi_breakdown: {
        PREMI_A: 70,
        PREMI_B: 30,
        PREMI_C: 20,
        PREMI_D: 10,
        PREMI_E: 8,
        PREMI_F: 7,
        PREMI_G: 6,
        PREMI_H: 5,
        PREMI_I: 4,
        PREMI_J: 3,
      },
    },
    {
      division_code: 'B',
      description: 'Estate B',
      prev_premi: 200,
      curr_premi: 700,
      diff_premi: 500,
      prev_ot: 70,
      curr_ot: 40,
      diff_ot: -30,
      premi_breakdown: {
        PREMI_A: 120,
        PREMI_B: 80,
        PREMI_C: 60,
        PREMI_D: 40,
        PREMI_E: 30,
        PREMI_F: 20,
        PREMI_G: 10,
        PREMI_H: 9,
        PREMI_I: 8,
        PREMI_J: 7,
      },
    },
    {
      division_code: 'C',
      description: 'Estate C',
      prev_premi: 500,
      curr_premi: 250,
      diff_premi: -250,
      prev_ot: 80,
      curr_ot: 20,
      diff_ot: -60,
      premi_breakdown: {},
    },
  ];

  it('calculates headline variance percentages and top division callouts', () => {
    const insights = buildAnalysisReportInsights({
      rows,
      totals: {
        prev_premi: 800,
        curr_premi: 1250,
        diff_premi: 450,
        prev_ot: 180,
        curr_ot: 220,
        diff_ot: 40,
      },
      headers: [],
      breakdownTotals: {},
    });

    expect(insights.premiChangePercent).toBe(56.25);
    expect(insights.overtimeChangePercent).toBeCloseTo(22.2222, 4);
    expect(insights.largestCostDriver.division_code).toBe('B');
    expect(insights.largestCostDriver.total_diff).toBe(470);
    expect(insights.largestPremiumDivision.division_code).toBe('B');
    expect(insights.largestOvertimeDivision.division_code).toBe('A');
  });

  it('keeps the print appendix to top 8 premi headers and rolls the rest into lainnya', () => {
    const insights = buildAnalysisReportInsights({
      rows,
      totals: {},
      headers: [
        'PREMI_A',
        'PREMI_B',
        'PREMI_C',
        'PREMI_D',
        'PREMI_E',
        'PREMI_F',
        'PREMI_G',
        'PREMI_H',
        'PREMI_I',
        'PREMI_J',
      ],
      breakdownTotals: {
        PREMI_A: 190,
        PREMI_B: 110,
        PREMI_C: 80,
        PREMI_D: 50,
        PREMI_E: 38,
        PREMI_F: 27,
        PREMI_G: 16,
        PREMI_H: 14,
        PREMI_I: 12,
        PREMI_J: 10,
      },
      topPremiumLimit: 8,
    });

    expect(insights.printPremiHeaders).toEqual([
      'PREMI_A',
      'PREMI_B',
      'PREMI_C',
      'PREMI_D',
      'PREMI_E',
      'PREMI_F',
      'PREMI_G',
      'PREMI_H',
      'LAINNYA',
    ]);
    expect(insights.otherPremiTotal).toBe(22);
    expect(insights.printPremiRows[0].print_breakdown.LAINNYA).toBe(7);
    expect(insights.printPremiRows[1].print_breakdown.LAINNYA).toBe(15);
  });

  it('normalizes gang rows and groups them by division for the analysis report', () => {
    const insights = buildAnalysisReportInsights({
      rows: [
        {
          division_code: 'PG1A',
          description: 'Estate Parit Gunung 1A',
          gang_code: 'A01',
          gang_description: 'Gang Panen Air Papan',
          prev_premi: 100,
          curr_premi: 220,
          diff_premi: 120,
          prev_ot: 20,
          curr_ot: 40,
          diff_ot: 20,
          premi_breakdown: { PREMI_A: 220 },
        },
        {
          division_code: 'PG1A',
          description: 'Estate Parit Gunung 1A',
          gang_code: 'A02',
          gang_description: 'Gang Rawat Air Papan',
          prev_premi: 200,
          curr_premi: 120,
          diff_premi: -80,
          prev_ot: 40,
          curr_ot: 10,
          diff_ot: -30,
          premi_breakdown: { PREMI_A: 120 },
        },
        {
          division_code: 'AB2',
          description: 'Estate Air Ruak 2',
          gang_code: 'B01',
          gang_description: '',
          prev_premi: 50,
          curr_premi: 70,
          diff_premi: 20,
          prev_ot: 10,
          curr_ot: 80,
          diff_ot: 70,
          premi_breakdown: { PREMI_A: 70 },
        },
      ],
      totals: {},
      headers: ['PREMI_A'],
      breakdownTotals: { PREMI_A: 410 },
    });

    expect(insights.rows[0]).toMatchObject({
      row_key: 'PG1A::A01',
      gang_label: 'A01',
      gang_description_label: 'Gang Panen Air Papan',
      division_label: 'PG1A - Estate Parit Gunung 1A',
      total_diff: 140,
      insight_label: 'Premi naik dominan',
    });
    expect(insights.rows[1].insight_label).toBe('Menekan biaya');
    expect(insights.rows[2].insight_label).toBe('Lembur naik dominan');
    expect(insights.rows[2].gang_description_label).toBe('-');
    expect(insights.groupedRows).toHaveLength(2);
    expect(insights.groupedRows[0]).toMatchObject({
      division_code: 'PG1A',
      division_label: 'PG1A - Estate Parit Gunung 1A',
      gang_count: 2,
      curr_premi: 340,
      curr_ot: 50,
      total_diff: 30,
    });
    expect(insights.groupedRows[0].premi_breakdown.PREMI_A).toBe(340);
    expect(insights.groupedRows[0].top_driver.gang_code).toBe('A01');
    expect(insights.groupedRows[0].top_driver.gang_label).toBe('A01');
    expect(insights.groupedRows[0].top_driver.gang_description_label).toBe('Gang Panen Air Papan');
    expect(insights.topCostReducers[0].gang_code).toBe('A02');
    expect(insights.largestPremiumGang.gang_code).toBe('A01');
    expect(insights.largestOvertimeGang.gang_code).toBe('B01');
  });
});
