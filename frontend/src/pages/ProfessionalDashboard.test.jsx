import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.resolve('src/pages/ProfessionalDashboard.jsx'), 'utf8');

describe('ProfessionalDashboard redesign shell', () => {
  it('renders role specific module section and sticky filter bar structure', () => {
    expect(source).toContain('Role Specific Modules');
    expect(source).toContain('Filter Payroll');
    expect(source).toContain("position: 'sticky'");
  });

  it('keeps core payroll module routes available in dashboard config', () => {
    expect(source).toContain("path: '/operational'");
    expect(source).toContain("path: '/executive'");
    expect(source).toContain("path: '/data-verification'");
  });

  it('contains KPI and analytics sections required by dashboard PRD', () => {
    expect(source).toContain('Payroll Snapshot');
    expect(source).toContain('Insight Payroll');
    expect(source).toContain('Quick Insight');
  });
});
