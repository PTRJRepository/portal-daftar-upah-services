import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.resolve('src/layouts/DashboardLayout.jsx'), 'utf8');

describe('DashboardLayout sidebar IA alignment', () => {
  it('uses PRD-aligned section labels', () => {
    expect(source).toContain("section: 'Operational'");
    expect(source).toContain("section: 'Analysis'");
    expect(source).toContain("section: 'Finance'");
    expect(source).toContain("section: 'Verification'");
  });

  it('keeps aligned sidebar entries for redesigned dashboard modules', () => {
    expect(source).toContain("label: 'Executive Payroll'");
    expect(source).toContain("label: 'Verifikasi Data'");
    expect(source).toContain("label: 'Seeder'");
  });
});
