/** @vitest-environment jsdom */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import DbPtrjCompareReportModal from './DbPtrjCompareReportModal';

describe('DbPtrjCompareReportModal', () => {
    it('renders mismatch rows with both active and DB_PTRJ values', () => {
        const html = renderToString(
            <DbPtrjCompareReportModal
                report={{
                    division: 'PG2B',
                    gang: 'D1H',
                    month: 4,
                    year: 2026,
                    comparedCount: 2,
                    matchCount: 1,
                    mismatchCount: 1,
                    mismatches: [
                        {
                            gang_code: 'D1H',
                            emp_code: 'B0001',
                            nik: '3171',
                            nama: 'BUDI',
                            label: 'SPSI',
                            active: 4000,
                            db_ptrj: 400,
                            diff: 3600
                        }
                    ]
                }}
                onClose={() => {}}
            />
        );

        expect(html).toContain('Compare DB_PTRJ');
        expect(html).toContain('Active');
        expect(html).toContain('DB_PTRJ');
        expect(html).toContain('4.000');
        expect(html).toContain('400');
        expect(html).toContain('3.600');
        expect(html).toContain('db-ptrj-compare-report__row--mismatch');
    });

    it('shows an empty-state message when there is no comparable data', () => {
        const html = renderToString(
            <DbPtrjCompareReportModal
                report={{
                    comparedCount: 0,
                    matchCount: 0,
                    mismatchCount: 0,
                    mismatches: []
                }}
                onClose={() => {}}
            />
        );

        expect(html).toContain('Belum ada data compare DB_PTRJ');
    });
});
