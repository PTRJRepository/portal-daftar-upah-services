/** @vitest-environment jsdom */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import CustomPayrollTable from './CustomPayrollTable';

const mocked = vi.hoisted(() => ({
    chapterBarProps: null
}));

vi.mock('../utils/payrollViewportChapters', async () => {
    const actual = await vi.importActual('../utils/payrollViewportChapters');
    return {
        ...actual,
        resolvePayrollDisplayModeState: () => ({
            mode: 'detail',
            focusLens: false
        })
    };
});

vi.mock('../hooks/usePayrollStream', () => ({
    usePayrollStream: () => ({
        gangs: [
            {
                gang_code: 'D1H',
                employees: [
                    {
                        nik: '3171',
                        emp_code: 'B0001',
                        gang_code: 'D1H',
                        emp_name: 'Test Employee'
                    }
                ],
                gang_totals: {}
            }
        ],
        meta: {
            dynamic_premi_headers: ['premi_insentif'],
            dynamic_potongan_headers: ['koreksi_denda_panen', 'potongan_lainnya_kasbon'],
            premi_title_map: {
                premi_insentif: 'PREMI INSENTIF'
            },
            potongan_title_map: {
                koreksi_denda_panen: 'KOREKSI DENDA PANEN',
                potongan_lainnya_kasbon: 'POTONGAN LAINNYA KASBON'
            }
        },
        progress: { stage: null },
        grandTotal: null,
        error: null,
        isComplete: true,
        gangsMap: {},
        startStream: vi.fn(),
        abort: vi.fn(),
        totalBytesReceived: 0
    })
}));

vi.mock('./PayrollScrollChapterBar', () => ({
    default: (props) => {
        mocked.chapterBarProps = props;
        return null;
    }
}));

describe('CustomPayrollTable render', () => {
    it('renders without referencing header style before initialization', () => {
        expect(() => renderToString(
            <CustomPayrollTable
                token="test-token"
                division="PG2B"
                gangCode="D1H"
                month={4}
                year={2026}
            />
        )).not.toThrow();
    });

    it('shows add-column affordances for premi and both potongan groups in edit mode', () => {
        mocked.chapterBarProps = null;
        const html = renderToString(
            <CustomPayrollTable
                token="test-token"
                division="PG2B"
                gangCode="D1H"
                month={4}
                year={2026}
                isEditMode
            />
        );

        expect(html).toContain('Tambah kolom premi baru');
        expect(html).toContain('Tambah kolom potongan kotor baru');
        expect(html).toContain('Tambah kolom potongan bersih baru');
        expect(mocked.chapterBarProps?.isVisible).toBe(false);
        expect(() => mocked.chapterBarProps.onSelectGroup('IDENTITAS')).not.toThrow();
    });
});
