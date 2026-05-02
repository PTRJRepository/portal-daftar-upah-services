/** @vitest-environment jsdom */
import React from 'react';
import { readFileSync } from 'node:fs';
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
    streamEmployees: null,
    streamIsComplete: true,
    streamProgress: { stage: null },
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
                employees: mocked.streamEmployees || [mocked.streamEmployee],
                gang_totals: {}
            }
        ],
        meta: mocked.streamMeta,
        progress: mocked.streamProgress,
        grandTotal: null,
        error: null,
        isComplete: mocked.streamIsComplete,
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

const findFirstCellHtml = (html, field) => {
    const escapedField = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = html.match(new RegExp(`<td\\b(?=[^>]*data-field="${escapedField}")[^>]*>[\\s\\S]*?<\\/td>`));
    return match?.[0] || '';
};

describe('CustomPayrollTable render', () => {
    it('keeps the payroll table scroll container from chaining scroll to the page', () => {
        const css = readFileSync('src/styles/CustomPayrollTable.css', 'utf8');

        expect(css).toMatch(/\.payroll-table-container\s*\{[^}]*overscroll-behavior:\s*contain;/s);
        expect(css).toMatch(/\.payroll-table-container\s*\{[^}]*overflow-anchor:\s*none;/s);
    });

    it('keeps highlighted-row detail controls readable on light control surfaces', () => {
        const css = readFileSync('src/styles/CustomPayrollTable.css', 'utf8');
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);

        const table = document.createElement('table');
        table.className = 'payroll-table';
        table.innerHTML = `
            <tbody>
                <tr class="row-highlighted">
                    <td>
                        <button type="button" style="background: rgb(248, 250, 252);">Detail</button>
                        <input style="background: rgb(255, 255, 255);" value="123" />
                    </td>
                </tr>
            </tbody>
        `;
        document.body.appendChild(table);

        try {
            const button = table.querySelector('button');
            const input = table.querySelector('input');

            expect(css).toMatch(/row-highlighted td \*:not\(button\):not\(input\):not\(select\):not\(textarea\):not\(option\)/);
            expect(window.getComputedStyle(button).color).not.toBe('inherit');
            expect(window.getComputedStyle(input).color).toBe('rgb(15, 23, 42)');
        } finally {
            table.remove();
            style.remove();
        }
    });

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

    it('keeps streamed employee rows ordered by emp_code while loading', () => {
        mocked.streamEmployees = [
            { nik: '2', emp_code: 'A0010', gang_code: 'D1H', nama: 'Ten Employee' },
            { nik: '1', emp_code: 'A0002', gang_code: 'D1H', nama: 'Two Employee' },
            { nik: '3', emp_code: 'A0001', gang_code: 'D1H', nama: 'Alpha Employee' }
        ];
        mocked.streamIsComplete = false;
        mocked.streamProgress = { stage: 'attendance_loaded' };

        try {
            const html = renderToString(
                <CustomPayrollTable
                    token="test-token"
                    division="PG2B"
                    gangCode="D1H"
                    month={4}
                    year={2026}
                />
            );

            const alphaIndex = html.indexOf('Alpha Employee');
            const twoIndex = html.indexOf('Two Employee');
            const tenIndex = html.indexOf('Ten Employee');

            expect(alphaIndex).toBeGreaterThan(-1);
            expect(alphaIndex).toBeLessThan(twoIndex);
            expect(twoIndex).toBeLessThan(tenIndex);
        } finally {
            mocked.streamEmployees = null;
            mocked.streamIsComplete = true;
            mocked.streamProgress = { stage: null };
        }
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

    it('renders manual bantu brondol separately while hiding DB_PTRJ brondol aliases', () => {
        mocked.streamMeta = {
            dynamic_premi_headers: ['premi_brondol', 'premi_brondol_total', 'premi_bantu_brondol', 'premi_insentif'],
            dynamic_potongan_headers: ['potongan_SPSI', 'SPSI', 'potongan_lainnya_kasbon'],
            premi_title_map: {
                premi_brondol: 'PREMI BRONDOL',
                premi_brondol_total: 'PREMI BRONDOL TOTAL',
                premi_bantu_brondol: 'PREMI BANTU BRONDOL',
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
            premi_bantu_brondol: 15000,
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
        expect(html).toContain('BANTU BRONDOL');
        expect(html).toContain('data-field="premi_bantu_brondol"');
        expect(html).not.toContain('data-field="potongan_SPSI"');
        expect(html).not.toContain('data-field="SPSI"');
        expect(html).toContain('INSENTIF');
        expect(html).toContain('KASBON');
    });

    it('keeps automatic koreksi HK in penggajian without showing static gross koreksi fallback', () => {
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
            gaji_pokok_aktual: 2500000,
            gaji_pokok_ideal: 2600000,
            koreksi_hk: -100000,
            pot_koreksi: 100000,
            potongan_upah_kotor_total: 100000
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

        expect(html).toContain('KOR. HK');
        expect(html).toContain('data-field="koreksi_hk"');
        expect(html).not.toMatch(/cell-group-potongan-upah-kotor[^>]*data-field="koreksi_hk"/);
        expect(html).not.toContain('data-field="pot_koreksi"');
        expect(html).not.toContain('KOREKSI GROSS');
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
        expect(html).toContain('650.000');
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
            value_sync_frame: {
                premi_pruning: 'red'
            },
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

        const cellHtml = findFirstCellHtml(html, 'premi_pruning');
        expect(html).toContain('PRUNING');
        expect(cellHtml).toContain('650.000');
        expect(cellHtml).toContain('cell-sync-red');
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
        expect(html).toContain('50.000');
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
            value_sync_frame: {
                koreksi_panen: 'green'
            },
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

        const cellHtml = findFirstCellHtml(html, 'koreksi_panen');
        expect(html).toContain('KOR. PANEN');
        expect(cellHtml).toContain('50.000');
        expect(cellHtml).toContain('cell-sync-green');
        expect(html).toContain('title="Lihat detail koreksi"');
        expect(html).toContain('Detail');
    });
});
