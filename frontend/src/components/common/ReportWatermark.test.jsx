/** @vitest-environment jsdom */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';

const { act } = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import ReportWatermark from './ReportWatermark';

describe('ReportWatermark', () => {
  it('renders a print-only Rebinmas watermark layer', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(<ReportWatermark />);
      });

      const watermark = container.querySelector('.report-watermark');
      const pattern = container.querySelector('.report-watermark__pattern');
      const marks = container.querySelectorAll('.report-watermark__tile img');

      expect(watermark).not.toBeNull();
      expect(watermark.getAttribute('aria-hidden')).toBe('true');
      expect(pattern).not.toBeNull();
      expect(marks.length).toBeGreaterThanOrEqual(18);
      expect(marks[0]?.getAttribute('src')).toBe('/images/rebinmas.webp');
      expect(container.textContent || '').not.toMatch(/RESMI|CREDENTIAL|REBINMAS/i);
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });
});
