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
    },
    streamMeta: {
        dynamic_premi_headers: ['premi_insentif'],
        dynamic_potongan_headers: ['koreksi_denda_panen', 'potongan_lainnya_kasbon'],
        premi_title_map: {
            premi_insentif: 'PREMI INSENTIF'
        },
        potongan_title_map: {
            koreksi_denda_panen: 'KOREKSI DENDA PANEN',
            potongan_lainnya_kasbon: 'POTONGAN LAINNYA KASBON'
        }
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
        meta: mocked.streamMeta,
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
        mocked.streamMeta = {
            dynamic_premi_headers: ['premi_insentif'],
            dynamic_potongan_headers: ['koreksi_denda_panen', 'potongan_lainnya_kasbon'],
            premi_title_map: {
                premi_insentif: 'PREMI INSENTIF'
            },
            potongan_title_map: {
                koreksi_denda_panen: 'KOREKSI DENDA PANEN',
                potongan_lainnya_kasbon: 'POTONGAN LAINNYA KASBON'
            }
        };
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

    it('does not render static brondol and SPSI aliases as duplicate dynamic columns', () => {
        mocked.streamMeta = {
            dynamic_premi_headers: ['premi_brondol', 'premi_brondol_total', 'premi_insentif'],
            dynamic_potongan_headers: ['potongan_SPSI', 'SPSI', 'potongan_lainnya_kasbon'],
            premi_title_map: {
                premi_brondol: 'PREMI BRONDOL',
                premi_brondol_total: 'PREMI BRONDOL TOTAL',
                premi_insentif: 'PREMI INSENTIF'
            },
            potongan_title_map: {
                potongan_SPSI: 'SPSI',
                SPSI: 'SPSI',
                potongan_lainnya_kasbon: 'POTONGAN LAINNYA KASBON'
            }
        };
        mocked.streamEmployee = {
            nik: '3171',
            emp_code: 'B0001',
            gang_code: 'D1H',
            emp_name: 'Test Employee',
            premi_brondol: 125000,
            premi_brondol_total: 125000,
            premi_insentif: 50000,
            pot_spsi: 4000,
            potongan_SPSI: 4000,
            SPSI: 4000,
            potongan_lainnya_kasbon: 25000,
            total_premi: 175000,
            total_potongan_bersih: 29000
        };

        const html = renderToString(
            <CustomPayrollTable
                token="test-token"
                division="PG2B"
                gangCode="D1H"
                month={4}
                year={2026}
            />
        );

        expect((html.match(/>BRONDOL</g) || []).length).toBe(1);
        expect((html.match(/>SPSI \(-\)</g) || []).length).toBe(1);
        expect(html).not.toContain('BRONDOL TOTAL');
        expect(html).not.toContain('data-field="premi_brondol_total"');
        expect(html).not.toContain('data-field="potongan_SPSI"');
        expect(html).not.toContain('data-field="SPSI"');
        expect(html).toContain('INSENTIF');
        expect(html).toContain('KASBON');
    });

    it('renders only total pendapatan lainnya without detail income columns', () => {
        mocked.streamMeta = {
            dynamic_premi_headers: [],
            dynamic_potongan_headers: [],
            premi_title_map: {},
            potongan_title_map: {}
        };
        mocked.streamEmployee = {
            nik: '3171',
            emp_code: 'B0001',
            gang_code: 'D1H',
            emp_name: 'Test Employee',
            pendapatan_thr: 100000,
            pendapatan_bonus: 50000,
            pendapatan_kontan: 25000,
            total_pendapatan_lainnya: 175000
        };

        const html = renderToString(
            <CustomPayrollTable
                token="test-token"
                division="PG2B"
                gangCode="D1H"
                month={4}
                year={2026}
            />
        );

        expect(html).toContain('TOTAL (+)');
        expect(html).toContain('PEND. LAIN (-)');
        expect(html).not.toContain('THR (+)');
        expect(html).not.toContain('BONUS (+)');
        expect(html).not.toContain('KONTAN (+)');
        expect(html).not.toContain('THR (-)');
        expect(html).not.toContain('BONUS (-)');
        expect(html).not.toContain('KONTAN (-)');
        expect(html).not.toContain('data-field="pendapatan_thr"');
        expect(html).not.toContain('data-field="pendapatan_bonus"');
        expect(html).not.toContain('data-field="pendapatan_kontan"');
    });

    it('shows premium detail action in view mode when metadata exists', () => {
        mocked.streamMeta = {
            dynamic_premi_headers: ['premi_pruning'],
            dynamic_potongan_headers: [],
            premi_title_map: {
                premi_pruning: 'PREMI PRUNING'
            },
            potongan_title_map: {}
        };
        mocked.streamEmployee = {
            nik: '3171',
            emp_code: 'B0001',
            gang_code: 'D1H',
            emp_name: 'Test Employee',
            premi_pruning: 650000,
            total_premi: 650000,
            manual_adjustment_metadata: {
                premi_pruning: {
                    input_type: 'blok',
                    items: [{ subblok: 'P09/15', gang_code: 'D1H', jumlah: 650000 }],
                    total_amount: 650000
                }
            }
        };

        const html = renderToString(
            <CustomPayrollTable
                token="test-token"
                division="PG2B"
                gangCode="D1H"
                month={4}
                year={2026}
            />
        );

        expect(html).toContain('PRUNING');
        expect(html).toContain('title="Lihat detail pekerjaan"');
        expect(html).toContain('Detail');
    });

    it('shows premium detail action when only manual adjustment metadata declares the field', () => {
        mocked.streamMeta = {
            dynamic_premi_headers: [],
            dynamic_potongan_headers: [],
            premi_title_map: {},
            potongan_title_map: {}
        };
        mocked.streamEmployee = {
            nik: '3171',
            emp_code: 'B0001',
            gang_code: 'D1H',
            emp_name: 'Test Employee',
            total_premi: 0,
            manual_adjustment_metadata: {
                premi_pruning: {
                    input_type: 'blok',
                    adjustment_name: 'PREMI PRUNING',
                    items: [{ subblok: 'P09/15', gang_code: 'D1H', jumlah: 650000 }],
                    total_amount: 650000
                }
            }
        };

        const html = renderToString(
            <CustomPayrollTable
                token="test-token"
                division="PG2B"
                gangCode="D1H"
                month={4}
                year={2026}
            />
        );

        expect(html).toContain('PRUNING');
        expect(html).toContain('title="Lihat detail pekerjaan"');
        expect(html).toContain('Detail');
    });

    it('does not mark non pruning/raking premium detail mismatch as red', () => {
        mocked.streamMeta = {
            dynamic_premi_headers: ['premi_tbs'],
            dynamic_potongan_headers: [],
            premi_title_map: {
                premi_tbs: 'PREMI TBS'
            },
            potongan_title_map: {}
        };
        mocked.streamEmployee = {
            nik: '3171',
            emp_code: 'B0001',
            gang_code: 'D1H',
            emp_name: 'Test Employee',
            premi_tbs: 650000,
            total_premi: 650000,
            manual_adjustment_metadata: {
                premi_tbs: {
                    input_type: 'blok',
                    adjustment_name: 'PREMI TBS',
                    items: [{ subblok: 'P09/15', gang_code: 'D1H', jumlah: 677650 }],
                    total_amount: 677650,
                    amount: 650000
                }
            },
            manual_adjustment_metadata_mismatch: {
                premi_tbs: {
                    amount: 650000,
                    detail_total: 677650,
                    diff: 27650
                }
            }
        };

        const html = renderToString(
            <CustomPayrollTable
                token="test-token"
                division="PG2B"
                gangCode="D1H"
                month={4}
                year={2026}
            />
        );

        expect(html).toContain('TBS');
        expect(html).toContain('title="Lihat detail pekerjaan"');
        expect(html).not.toContain('Detail beda');
        expect(html).not.toContain('Total detail 677.650 berbeda dari amount 650.000');
    });

    it('marks incomplete structured premium metadata as red in edit mode', () => {
        mocked.streamMeta = {
            dynamic_premi_headers: ['premi_ritase'],
            dynamic_potongan_headers: [],
            premi_title_map: {
                premi_ritase: 'PREMI RITASE'
            },
            potongan_title_map: {}
        };
        mocked.streamEmployee = {
            nik: '3171',
            emp_code: 'B0001',
            gang_code: 'D1H',
            emp_name: 'Test Employee',
            premi_ritase: 150000,
            total_premi: 150000,
            manual_adjustment_metadata: {
                premi_ritase: {
                    input_type: 'kendaraan',
                    adjustment_name: 'PREMI RITASE',
                    items: [{ nomor_kendaraan: '', expense_code: 'ANGKUT', jumlah: 150000 }],
                    total_amount: 150000,
                    amount: 150000
                }
            }
        };

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

        expect(html).toContain('RITASE');
        expect(html).toContain('Data detail belum lengkap');
        expect(html).toContain('nomor kendaraan wajib diisi');
        expect(html).toContain('background:#fee2e2');
    });

    it('shows a per-cell delete action for manual adjustment values in edit mode', () => {
        mocked.streamMeta = {
            dynamic_premi_headers: ['premi_pruning'],
            dynamic_potongan_headers: [],
            premi_title_map: {
                premi_pruning: 'PREMI PRUNING'
            },
            potongan_title_map: {}
        };
        mocked.streamEmployee = {
            nik: '3171',
            emp_code: 'B0001',
            gang_code: 'D1H',
            emp_name: 'Test Employee',
            premi_pruning: 650000,
            total_premi: 650000,
            manual_adjustment_metadata: {
                premi_pruning: {
                    input_type: 'blok',
                    adjustment_name: 'PREMI PRUNING',
                    items: [{ subblok: 'P09/15', gang_code: 'D1H', jumlah: 650000 }],
                    total_amount: 650000,
                    amount: 650000
                }
            }
        };

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

        expect(html).toContain('PRUNING');
        expect(html).toContain('title="Hapus nilai cell manual adjustment"');
        expect(html).not.toContain('Hapus kolom manual adjustment: PREMI PRUNING');
    });

    it('shows koreksi detail action in view mode because koreksi is blok-based', () => {
        mocked.streamMeta = {
            dynamic_premi_headers: [],
            dynamic_potongan_headers: ['koreksi_panen'],
            premi_title_map: {},
            potongan_title_map: {
                koreksi_panen: 'KOREKSI PANEN'
            }
        };
        mocked.streamEmployee = {
            nik: '3171',
            emp_code: 'B0001',
            gang_code: 'D1H',
            emp_name: 'Test Employee',
            koreksi_panen: 50000,
            potongan_upah_kotor_total: 50000,
            manual_adjustment_metadata: {
                koreksi_panen: {
                    input_type: 'blok',
                    items: [{ subblok: 'P09/15', gang_code: 'D1H', jumlah: 50000 }],
                    total_amount: 50000
                }
            }
        };

        const html = renderToString(
            <CustomPayrollTable
                token="test-token"
                division="PG2B"
                gangCode="D1H"
                month={4}
                year={2026}
            />
        );

        expect(html).toContain('KOR. PANEN');
        expect(html).toContain('title="Lihat detail koreksi"');
        expect(html).toContain('Detail');
    });

    it('shows koreksi detail action when only manual adjustment metadata declares the field', () => {
        mocked.streamMeta = {
            dynamic_premi_headers: [],
            dynamic_potongan_headers: [],
            premi_title_map: {},
            potongan_title_map: {}
        };
        mocked.streamEmployee = {
            nik: '3171',
            emp_code: 'B0001',
            gang_code: 'D1H',
            emp_name: 'Test Employee',
            potongan_upah_kotor_total: 0,
            manual_adjustment_metadata: {
                koreksi_panen: {
                    input_type: 'blok',
                    adjustment_name: 'KOREKSI PANEN',
                    items: [{ subblok: 'P09/15', gang_code: 'D1H', jumlah: 50000 }],
                    total_amount: 50000
                }
            }
        };

        const html = renderToString(
            <CustomPayrollTable
                token="test-token"
                division="PG2B"
                gangCode="D1H"
                month={4}
                year={2026}
            />
        );

        expect(html).toContain('KOR. PANEN');
        expect(html).toContain('title="Lihat detail koreksi"');
        expect(html).toContain('Detail');
    });
});
