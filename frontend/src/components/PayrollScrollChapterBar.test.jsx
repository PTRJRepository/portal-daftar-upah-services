import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import PayrollScrollChapterBar from './PayrollScrollChapterBar';

describe('PayrollScrollChapterBar', () => {
    it('renders custom horizontal slider with progress text', () => {
        const html = renderToString(
            <PayrollScrollChapterBar
                isVisible
                activeGroup="PENGGAJIAN"
                allGroups={['IDENTITAS', 'PENGGAJIAN', 'UPAH BERSIH']}
                horizontalCanScroll
                horizontalScrollRatio={0.42}
                horizontalViewportRatio={0.35}
                onSelectGroup={vi.fn()}
                onHorizontalScrollChange={vi.fn()}
            />
        );

        expect(html).toContain('Geser Horizontal');
        expect(html).toContain('Tampilan');
        expect(html).toContain('value="420"');
        expect(html).toContain('Slider horizontal tabel daftar upah');
    });

    it('disables slider controls when there is no horizontal overflow', () => {
        const html = renderToString(
            <PayrollScrollChapterBar
                isVisible
                activeGroup="IDENTITAS"
                allGroups={['IDENTITAS']}
                horizontalCanScroll={false}
                onSelectGroup={vi.fn()}
                onHorizontalScrollChange={vi.fn()}
            />
        );

        expect(html).toContain('payroll-footer-scrollbar is-disabled');
        expect(html).toContain('disabled=""');
    });
});
