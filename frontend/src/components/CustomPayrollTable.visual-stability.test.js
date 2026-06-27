import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const tableSource = fs.readFileSync(path.resolve('src/components/CustomPayrollTable.jsx'), 'utf8');
const cssSource = fs.readFileSync(path.resolve('src/styles/CustomPayrollTable.css'), 'utf8');

describe('CustomPayrollTable visual stability guardrails', () => {
  it('does not feed table resize changes back into responsive scale', () => {
    expect(tableSource).toContain('getBoundingClientRect?.().width');
    expect(tableSource).not.toContain('observer.observe(table)');
  });

  it('uses parent height instead of viewport height for the table shell', () => {
    expect(tableSource).toContain("height: '100%'");
    expect(tableSource).not.toContain("height: 'calc(100vh - 120px)'");
  });

  it('keeps scroll-driven active group styling from changing body text appearance', () => {
    expect(cssSource).toContain('.payroll-table-shell .payroll-table tbody td[data-active-group="true"]');
    expect(cssSource).toContain('font-weight: inherit;');
    expect(cssSource).toContain('color: inherit;');
    expect(cssSource).toContain('box-shadow: none;');
    expect(cssSource).not.toContain('font-weight: 750;');
  });

  it('disables table row entrance animations during normal table rendering', () => {
    expect(cssSource).toContain('.payroll-table tbody tr.row-animating');
    expect(cssSource).toContain('animation: none;');
    expect(cssSource).toContain('prefers-reduced-motion: reduce');
  });
});
