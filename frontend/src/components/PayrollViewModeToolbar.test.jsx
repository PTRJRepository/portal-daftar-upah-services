/** @vitest-environment jsdom */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import PayrollViewModeToolbar from './PayrollViewModeToolbar';

describe('PayrollViewModeToolbar', () => {
    it('shows only DB_PTRJ and Non DB_PTRJ source modes', () => {
        const html = renderToString(
            <PayrollViewModeToolbar valuePriorityMode="smart" />
        );

        expect(html).toContain('Non DB_PTRJ');
        expect(html).toContain('DB_PTRJ Only');
        expect(html).not.toContain('Auto Buffer Aktif');
        expect(html).not.toContain('DB_PTRJ Aktif');
        expect(html).not.toContain('Klik:');
    });
});
