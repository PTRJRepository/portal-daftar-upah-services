import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.resolve('src/pages/ProfessionalDashboard.jsx'), 'utf8');

describe('ProfessionalDashboard dark palm redesign', () => {
  it('renders dark palm theme structure (hero, filter card, module sections)', () => {
    expect(source).toContain('dashboard-dark');
    expect(source).toContain('Filter Payroll');
    expect(source).toContain('Tampilkan Daftar Upah');
    expect(source).toContain('Dashboard Payroll');
    expect(source).toContain('Periode Aktif');
  });

  it('keeps core payroll module routes available in dashboard config', () => {
    expect(source).toContain("path: '/operational'");
    expect(source).toContain("path: '/executive'");
    expect(source).toContain("path: '/data-verification'");
  });

  it('exposes payslip, attendance, overtime, and staging comparison modules', () => {
    expect(source).toContain("path: '/payslip-print'");
    expect(source).toContain("path: '/operational?view=attendance'");
    expect(source).toContain("path: '/operational?view=overtime'");
    expect(source).toContain("path: '/staging-comparison'");
  });

  it('contains KPI and analytics sections required by dashboard PRD', () => {
    expect(source).toContain('Payroll Snapshot');
    expect(source).toContain('Insight Payroll');
    expect(source).toContain('Total Upah');
    expect(source).toContain('Cost / HK');
  });

  it('keeps role-based module visibility (kerani vs admin vs finance)', () => {
    expect(source).toContain("label: 'Daftar Upah'");
    expect(source).toContain("'payroll_admin', 'kerani'");
    expect(source).toContain("label: 'Koreksi'");
    expect(source).toContain("guessRole");
  });

  it('imports the dark palm theme stylesheet', () => {
    expect(source).toContain("dashboard-dark-palm.css");
  });
});
