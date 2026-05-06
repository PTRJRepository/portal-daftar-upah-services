import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./print-overrides.css', import.meta.url), 'utf8');
const dashboardLayoutSource = readFileSync(new URL('../layouts/DashboardLayout.jsx', import.meta.url), 'utf8');

describe('global print overrides', () => {
  it('marks dashboard layout ancestors so print cannot be clipped by app chrome wrappers', () => {
    expect(dashboardLayoutSource).toContain('dashboard-layout-root');
    expect(dashboardLayoutSource).toContain('dashboard-layout-main');
    expect(dashboardLayoutSource).toContain('dashboard-layout-content print-content-area');
  });

  it('resets dashboard layout ancestors to natural document flow for print', () => {
    expect(css).toMatch(/\.dashboard-layout-root,\s*[\s\S]*\.dashboard-layout-main,\s*[\s\S]*\.dashboard-layout-content\s*{[\s\S]*height:\s*auto\s*!important;/);
    expect(css).toMatch(/\.dashboard-layout-root,\s*[\s\S]*\.dashboard-layout-main,\s*[\s\S]*\.dashboard-layout-content\s*{[\s\S]*overflow:\s*visible\s*!important;/);
    expect(css).toMatch(/\.dashboard-layout-root,\s*[\s\S]*\.dashboard-layout-main,\s*[\s\S]*\.dashboard-layout-content\s*{[\s\S]*display:\s*block\s*!important;/);
  });
});
