import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./WagesSummaryRebinmasPage.jsx', import.meta.url), 'utf8');

describe('WagesSummaryRebinmasPage comparison KPI cards', () => {
  it('renders comparison KPI cards through a shared simple card helper', () => {
    expect(source).toContain('renderComparisonMetricCard');
    expect(source).toContain('getComparisonDelta');
    expect(source).toContain('comparison-main-value');
    expect(source).toContain('wsp-kpi-delta-chip');
    expect(source).toContain('wsp-kpi-direction');
  });

  it('shows up/down arrow indicators for all comparison metrics', () => {
    expect(source).toContain('ArrowUpRight');
    expect(source).toContain('ArrowDownRight');
    expect(source).toContain('Total Upah Bersih');
    expect(source).toContain('Total Premi');
    expect(source).toContain('Total Lembur');
    expect(source).toContain('Total Tonase TBS');
  });

  it('renders premi breakdown as compact comparison cards', () => {
    expect(source).toContain('wsp-mini-kpi-grid');
    expect(source).toContain('wsp-mini-kpi-card');
    expect(source).toContain('total_prunning_previous');
    expect(source).toContain('total_kinerja_previous');
  });

  it('renders tonase table cells with trend arrows in screen and print comparison tables', () => {
    expect(source).toContain('renderTrendValue');
    expect(source).toContain('renderTrendValue(row.current_month?.tbs_weight');
    expect(source).toContain('renderTrendValue(grandTotal.curr_tbs');
    expect(source).toContain('wages-comparison-cell-value');
  });
});
