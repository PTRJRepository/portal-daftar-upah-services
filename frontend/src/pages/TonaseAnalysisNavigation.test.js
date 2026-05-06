import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
const layoutSource = readFileSync(new URL('../layouts/DashboardLayout.jsx', import.meta.url), 'utf8');
const homeSource = readFileSync(new URL('./DashboardHome.jsx', import.meta.url), 'utf8');

describe('Tonase analysis navigation', () => {
  it('registers the tonase analysis route', () => {
    expect(appSource).toContain("import TonaseAnalysisReportPage from './pages/TonaseAnalysisReportPage'");
    expect(appSource).toContain('path="tonase-analysis"');
    expect(appSource).toContain('component={TonaseAnalysisReportPage}');
  });

  it('adds sidebar and dashboard shortcut entries', () => {
    expect(layoutSource).toContain("to: '/tonase-analysis'");
    expect(layoutSource).toContain("label: 'Analisis Tonase'");
    expect(homeSource).toContain("navigate('/tonase-analysis')");
    expect(homeSource).toContain('Analisis Tonase');
  });
});
