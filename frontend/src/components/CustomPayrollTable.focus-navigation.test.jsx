/** @vitest-environment jsdom */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

const { act } = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocked = vi.hoisted(() => ({
    chapterBarProps: null,
    axiosGetMock: vi.fn(() => Promise.resolve({ data: { success: false } })),
    selectedEmployees: [],
    onToggleEmployeeSelection: vi.fn(),
    onSelectAllEmployees: vi.fn(),
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
        }
    }
}));

vi.mock('../utils/payrollViewportChapters', async () => {
    const actual = await vi.importActual('../utils/payrollViewportChapters');
    return {
        ...actual,
        resolvePayrollDisplayModeState: () => ({
            mode: 'simple',
            focusLens: false
        })
    };
});

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
    default: (props) => {
        mocked.chapterBarProps = props;
        return null;
    }
}));

import CustomPayrollTable from './CustomPayrollTable';

async function flushEffects() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe('CustomPayrollTable focus mode chapter navigation', () => {
    beforeEach(() => {
        mocked.chapterBarProps = null;
        mocked.axiosGetMock.mockClear();
    });

    it('keeps simple mode and updates active group when selecting a chapter tab', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const originalScrollTo = HTMLElement.prototype.scrollTo;
        HTMLElement.prototype.scrollTo = vi.fn();
        try {
            await act(async () => {
                root.render(
                    <CustomPayrollTable
                    token="test-token"
                    division="PG2B"
                    gangCode="D1H"
                    month={4}
                    year={2026}
                    selectedEmployees={mocked.selectedEmployees}
                    onToggleEmployeeSelection={mocked.onToggleEmployeeSelection}
                    onSelectAllEmployees={mocked.onSelectAllEmployees}
                />
            );
        });
            await flushEffects();

            expect(mocked.chapterBarProps).toBeTruthy();
            expect(mocked.chapterBarProps.displayMode).toBe('simple');

            const currentGroup = mocked.chapterBarProps.activeGroup;
            const targetGroup = (mocked.chapterBarProps.allGroups || []).find((group) => group !== currentGroup);
            expect(targetGroup).toBeTruthy();

            await act(async () => {
                mocked.chapterBarProps.onSelectGroup(targetGroup);
            });
            await flushEffects();

            expect(mocked.chapterBarProps.displayMode).toBe('simple');
            expect(mocked.chapterBarProps.activeGroup).toBe(targetGroup);
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
            HTMLElement.prototype.scrollTo = originalScrollTo;
        }
    });
});
