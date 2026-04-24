/** @vitest-environment jsdom */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

const { act } = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocked = vi.hoisted(() => ({
    axiosGetMock: vi.fn(() => Promise.resolve({ data: { success: false } })),
    streamState: {
        current: {
            gangs: [
                {
                    gang_code: 'D1H',
                    employees: [
                        {
                            nik: '3171',
                            emp_code: 'B0001',
                            gang_code: 'D1H',
                            nama: 'Test Employee',
                            emp_name: 'Test Employee',
                            potongan_upah_kotor_total: 0,
                            total_potongan_bersih: 0,
                            total_premi: 0,
                            jumlah_upah_kotor: 0,
                            upah_bersih: 0,
                        }
                    ],
                    gang_totals: {}
                }
            ],
            meta: {
                dynamic_premi_headers: ['premi_insentif'],
                dynamic_potongan_headers: ['koreksi_denda_panen'],
                premi_title_map: {
                    premi_insentif: 'PREMI INSENTIF'
                },
                potongan_title_map: {
                    koreksi_denda_panen: 'KOREKSI DENDA PANEN'
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
        }
    }
}));

vi.mock('../hooks/usePayrollStream', () => ({
    usePayrollStream: () => mocked.streamState.current
}));

vi.mock('axios', () => ({
    default: {
        get: mocked.axiosGetMock
    },
    get: mocked.axiosGetMock
}));

vi.mock('./PayrollScrollChapterBar', () => ({
    default: () => null
}));

import CustomPayrollTable from './CustomPayrollTable';

async function flushEffects() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe('CustomPayrollTable manual dynamic columns', () => {
    beforeEach(() => {
        mocked.axiosGetMock.mockClear();
    });

    it('keeps manually added potongan kotor column visible in edit mode after stream meta refresh', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Denda Test');

        try {
            await act(async () => {
                root.render(
                    <CustomPayrollTable
                        token="test-token"
                        division="PG2B"
                        gangCode="D1H"
                        month={4}
                        year={2026}
                        isEditMode
                    />
                );
            });
            await flushEffects();

            const addButton = container.querySelector('button[title="Tambah kolom potongan kotor baru"]');
            expect(addButton).toBeTruthy();

            await act(async () => {
                addButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
            await flushEffects();

            expect(container.textContent || '').toContain('KOR. DENDA TEST');

            mocked.streamState.current = {
                ...mocked.streamState.current,
                meta: {
                    ...mocked.streamState.current.meta
                },
                progress: {
                    stage: 'streaming',
                    message: 'Refresh metadata'
                }
            };

            await act(async () => {
                root.render(
                    <CustomPayrollTable
                        token="test-token"
                        division="PG2B"
                        gangCode="D1H"
                        month={4}
                        year={2026}
                        isEditMode
                    />
                );
            });
            await flushEffects();

            expect(container.textContent || '').toContain('KOR. DENDA TEST');
        } finally {
            promptSpy.mockRestore();
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });
});
