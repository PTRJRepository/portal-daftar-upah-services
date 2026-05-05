/** @vitest-environment jsdom */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';

const { act } = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import ReportPrintMetadata from './ReportPrintMetadata';

describe('ReportPrintMetadata', () => {
  it('renders non-empty report metadata badges and optional note', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <ReportPrintMetadata
            mode="Summary"
            source="History DB"
            scope="Real + Virtual"
            estate="Rebinmas"
            note="Total mengikuti agregasi backend."
          />
        );
      });

      expect(container.textContent || '').toContain('Mode: Summary');
      expect(container.textContent || '').toContain('Sumber: History DB');
      expect(container.textContent || '').toContain('Scope: Real + Virtual');
      expect(container.textContent || '').toContain('Estate: Rebinmas');
      expect(container.textContent || '').toContain('Total mengikuti agregasi backend.');
      expect(container.querySelectorAll('.report-source-badge')).toHaveLength(4);
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  it('omits empty metadata fields', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <ReportPrintMetadata
            mode="Analysis"
            source=""
            scope={null}
            estate={undefined}
          />
        );
      });

      expect(container.textContent || '').toContain('Mode: Analysis');
      expect(container.textContent || '').not.toContain('Sumber:');
      expect(container.textContent || '').not.toContain('Scope:');
      expect(container.textContent || '').not.toContain('Estate:');
      expect(container.querySelectorAll('.report-source-badge')).toHaveLength(1);
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });
});
