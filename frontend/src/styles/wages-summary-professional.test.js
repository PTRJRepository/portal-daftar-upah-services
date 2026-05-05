import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./wages-summary-professional.css', import.meta.url), 'utf8');

describe('wages summary professional print CSS', () => {
  it('does not print screen-only table header rows', () => {
    expect(css).toMatch(/@media\s+screen\s*{[\s\S]*tr\.no-print\s*{[\s\S]*display:\s*table-row\s*!important;/);
    expect(css).toMatch(/@media\s+print\s*{[\s\S]*tr\.no-print,\s*[\s\S]*th\.no-print,\s*[\s\S]*td\.no-print\s*{[\s\S]*display:\s*none\s*!important;/);
  });
});
