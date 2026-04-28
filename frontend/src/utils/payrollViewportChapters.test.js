import { describe, expect, it } from 'vitest';
import {
    buildPayrollViewportChapters,
    detectActivePayrollChapter,
    getPayrollViewportWindow,
    getPayrollChapterScrollLeft,
    resolvePayrollDisplayModeState
} from './payrollViewportChapters';

describe('resolvePayrollDisplayModeState', () => {
    it('defaults to detail mode with focus lens off', () => {
        expect(resolvePayrollDisplayModeState()).toEqual({
            mode: 'detail',
            focusLens: false
        });
    });

    it('normalizes detail mode and focus lens state', () => {
        expect(resolvePayrollDisplayModeState({ mode: 'detail', focusLens: true })).toEqual({
            mode: 'detail',
            focusLens: true
        });
    });
});

describe('buildPayrollViewportChapters', () => {
    it('aggregates contiguous columns by top-level group', () => {
        const chapters = buildPayrollViewportChapters([
            { field: 'nik', w: 55, headers: ['IDENTITAS', null, 'NIK'] },
            { field: 'nama', w: 160, headers: ['IDENTITAS', null, 'NAMA'] },
            { field: 'premi_brondol', w: 80, headers: ['PREMI', null, 'BRONDOL'] }
        ]);

        expect(chapters).toEqual([
            expect.objectContaining({ group: 'IDENTITAS', start: 0, width: 215, end: 215 }),
            expect.objectContaining({ group: 'PREMI', start: 215, width: 80, end: 295 })
        ]);
    });
});

describe('detectActivePayrollChapter', () => {
    it('chooses the chapter at the leading visible edge', () => {
        const active = detectActivePayrollChapter(
            [
                { group: 'IDENTITAS', start: 0, end: 200, width: 200 },
                { group: 'PREMI', start: 200, end: 500, width: 300 }
            ],
            { scrollLeft: 180, clientWidth: 240 }
        );

        expect(active).toBe('IDENTITAS');
    });

    it('uses sticky offset to detect chapter after frozen pane', () => {
        const active = detectActivePayrollChapter(
            [
                { group: 'IDENTITAS', start: 0, end: 200, width: 200 },
                { group: 'PREMI', start: 200, end: 500, width: 300 }
            ],
            { scrollLeft: 180, clientWidth: 240, stickyOffset: 40 }
        );

        expect(active).toBe('PREMI');
    });
});

describe('getPayrollChapterScrollLeft', () => {
    it('returns the target chapter start offset', () => {
        expect(getPayrollChapterScrollLeft([
            { group: 'IDENTITAS', start: 0, width: 200 },
            { group: 'PREMI', start: 200, width: 300 }
        ], 'PREMI')).toBe(200);
    });
});

describe('getPayrollViewportWindow', () => {
    it('returns viewport ratios for the visible horizontal window', () => {
        expect(getPayrollViewportWindow([
            { group: 'IDENTITAS', start: 0, end: 200, width: 200 },
            { group: 'PREMI', start: 200, end: 500, width: 300 }
        ], {
            scrollLeft: 100,
            clientWidth: 200
        })).toEqual({
            startRatio: 0.2,
            widthRatio: 0.4
        });
    });
});
