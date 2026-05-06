import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./WagesSummaryIJLPage.jsx', import.meta.url), 'utf8');

describe('WagesSummaryIJLPage thumbprint display', () => {
  it('renders missing IJL thumbprint values as zero instead of a blank placeholder', () => {
    expect(source).toContain('formatNumber(div.thumb_print ?? 0)');
    expect(source).toContain('formatNumber(group.subtotal.thumb_print ?? 0)');
    expect(source).toContain('formatNumber(ijlGrandTotal.thumb_print ?? 0)');
    expect(source).toContain('formatNumber(row.current_month?.thumb_print ?? 0)');
    expect(source).toContain('formatNumber(grandTotal.curr_thumb_print ?? 0)');
    expect(source).not.toContain('formatNumber(div.thumb_print)</td>');
    expect(source).not.toContain('formatNumber(ijlGrandTotal.thumb_print)</td>');
    expect(source).not.toContain('<td className="text-right font-semibold border-right-section">{formatNumber(currGaji)}</td>');
  });
});
