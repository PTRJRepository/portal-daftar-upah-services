import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./StagingComparisonPage.jsx', import.meta.url), 'utf8');

describe('StagingComparisonPage — pivot matrix structure', () => {
  it('uses pivot endpoints (not monthly/daily)', () => {
    expect(page).toContain('pivot-attendance');
    expect(page).toContain('pivot-overtime');
    expect(page).toContain('pivot-loosefruit');
  });

  it('has PivotMatrix component with days-as-columns', () => {
    expect(page).toContain('PivotMatrix');
    expect(page).toContain('daysInMonth');
    expect(page).toContain('days_in_month');
  });

  it('renders day numbers as column headers', () => {
    expect(page).toContain('Array.from({ length: daysInMonth }');
    expect(page).toContain('r.days[d]');
  });

  it('has S/P sub-header for staging vs prod', () => {
    expect(page).toContain('fbbf24'); // S color (amber)
    expect(page).toContain('86efac'); // P color (green)
    expect(page).toContain('total_staging');
    expect(page).toContain('total_prod');
  });

  it('has sticky identity columns (EmpCode, Nama)', () => {
    expect(page).toContain('stickyLeft');
    expect(page).toContain('emp_name');
    expect(page).toContain('gang_code');
  });

  it('has cell color coding for match/diff/staging-only/prod-only', () => {
    expect(page).toContain('cellBg');
    expect(page).toContain('fee2e2'); // staging only
    expect(page).toContain('dbeafe'); // prod only
    expect(page).toContain('fef3c7'); // diff
    expect(page).toContain('dcfce7'); // match
  });

  it('has division and gang dropdowns', () => {
    expect(page).toContain('selDiv');
    expect(page).toContain('selGang');
    expect(page).toContain('Semua Divisi');
  });

  it('has diff-only filter checkbox', () => {
    expect(page).toContain('showDiffOnly');
    expect(page).toContain('Hanya yang selisih');
  });

  it('has anomaly panel for loosefruit', () => {
    expect(page).toContain('AnomalyPanel');
    expect(page).toContain("module === 'loosefruit'");
  });

  it('has CSV export', () => {
    expect(page).toContain('exportCSV');
    expect(page).toContain('text/csv');
  });
});
