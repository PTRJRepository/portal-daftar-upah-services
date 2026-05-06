import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(new URL('./ExecutivePayrollPage.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/executive-payroll-print.css', import.meta.url), 'utf8');

describe('ExecutivePayrollPage print report', () => {
  it('renders a dedicated print-only executive report and hides the interactive dashboard for print', () => {
    expect(pageSource).toContain("import { printReport } from '../utils/printPageSetup';");
    expect(pageSource).toContain("import '../styles/executive-payroll-print.css';");
    expect(pageSource).toContain('buildExecutivePrintSummary');
    expect(pageSource).toContain('executive-dashboard-screen');
    expect(pageSource).toContain('id="executive-print-report"');
    expect(pageSource).toContain('executive-print-report print-only');
  });

  it('prints the executive report in landscape with compact black-and-white sections', () => {
    expect(pageSource).toContain("printReport({ orientation: 'landscape', margin: '7mm' })");
    expect(pageSource).toContain('Cetak Report');
    expect(pageSource).toContain("import { Printer } from 'lucide-react';");
    expect(pageSource).toContain('className="executive-print-button"');
    expect(pageSource).toContain('className="executive-print-button-icon"');
    expect(pageSource).toContain('aria-label="Cetak executive payroll report"');
    expect(pageSource).toContain('<Printer size={17} strokeWidth={2.4} aria-hidden="true" />');
    expect(pageSource).toContain('executive-print-kpi-grid');
    expect(pageSource).toContain('executive-print-insight-grid');
    expect(pageSource).toContain('executive-print-division-table');
    expect(pageSource).toContain('executive-print-trend-table');
    expect(pageSource).toContain('executive-print-alert-table');

    expect(css).toMatch(/@page\s+executive-payroll-landscape\s*{[\s\S]*size:\s*A4 landscape;[\s\S]*margin:\s*7mm;/);
    expect(css).toMatch(/\.executive-dashboard-screen\s*{[\s\S]*display:\s*none\s*!important;/);
    expect(css).toMatch(/#executive-print-report\.executive-print-report\s*{[\s\S]*display:\s*block\s*!important;/);
    expect(css).toMatch(/#executive-print-report \.executive-print-table th\s*{[\s\S]*background:\s*#fff\s*!important;[\s\S]*color:\s*#000\s*!important;/);
  });
});
