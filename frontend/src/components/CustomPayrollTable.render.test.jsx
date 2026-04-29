/** @vitest-environment jsdom */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import CustomPayrollTable from './CustomPayrollTable';

const mocked = vi.hoisted(() => ({
    chapterBarProps: null,
    streamEmployee: {
        nik: '3171',
        emp_code: 'B0001',
        gang_code: 'D1H',
        emp_name: 'Test Employee'
    }
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
                    mocked.streamEmployee
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

    it('shows DB_PTRJ comparison for mismatched SPSI auto-buffer values with a red frame', () => {
        mocked.streamEmployee = {
            nik: '3171',
            emp_code: 'B0001',
            gang_code: 'D1H',
            emp_name: 'Test Employee',
            pot_spsi: 4000,
            value_source_compare: {
                pot_spsi: { active: 4000, db_ptrj: 400 }
            },
            value_sync_frame: {
                pot_spsi: 'red'
            }
        };

        const html = renderToString(
            <CustomPayrollTable
                token="test-token"
                division="PG2B"
                gangCode="D1H"
                month={4}
                year={2026}
                valuePriorityMode="db_ptrj_only"
            />
        );

        expect(html).toContain('title="4.000 | 400"');
        expect(html).toContain('cell-sync-red');
        expect(html).toContain('payroll-value-compare__meta is-mismatch');
    });
});
