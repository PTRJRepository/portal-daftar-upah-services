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
            gangs: [],
            meta: null,
            progress: { stage: null },
            grandTotal: null,
            error: null,
            isComplete: false,
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
    default: { get: mocked.axiosGetMock },
    get: mocked.axiosGetMock
}));

import CustomPayrollTable from './CustomPayrollTable';

function buildStreamState({ gangs = [], isComplete = false } = {}) {
    return {
        gangs,
        meta: null,
        progress: { stage: isComplete ? 'complete' : 'streaming' },
        grandTotal: null,
        error: null,
        isComplete,
        gangsMap: {},
        startStream: vi.fn(),
        abort: vi.fn(),
        totalBytesReceived: 0
    };
}

function buildGang({ gangCode, employeeName, upahBersih = 0 }) {
    return {
        gang_code: gangCode,
        employees: [
            {
                nama: employeeName,
                emp_name: employeeName,
                emp_code: `${gangCode}-EMP`,
                nik: `${gangCode}-NIK`,
                gang_code: gangCode,
                upah_bersih: upahBersih
            }
        ],
        gang_totals: {}
    };
}

async function flushEffects() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe('CustomPayrollTable scope changes', () => {
    beforeEach(() => {
        mocked.axiosGetMock.mockClear();
    });

    it('clears stale employee rows when month changes and new stream is empty', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        let rowsGetter = () => [];
        const handleRowsGetterReady = vi.fn((getter) => {
            rowsGetter = getter;
        });

        mocked.streamState.current = buildStreamState({
            gangs: [buildGang({ gangCode: 'A1', employeeName: 'Budi Lama' })],
            isComplete: true
        });

        await act(async () => {
            root.render(
                <CustomPayrollTable
                    token="token"
                    division="PG2A"
                    gangCode="ALL"
                    month={1}
                    year={2026}
                    onRowsGetterReady={handleRowsGetterReady}
                />
            );
        });
        await flushEffects();

        const beforeScopeChangeRows = rowsGetter();
        expect(beforeScopeChangeRows.some((row) => row.type === 'employee' && row.nama === 'Budi Lama')).toBe(true);

        mocked.streamState.current = buildStreamState({
            gangs: [],
            isComplete: true
        });

        await act(async () => {
            root.render(
                <CustomPayrollTable
                    token="token"
                    division="PG2A"
                    gangCode="ALL"
                    month={2}
                    year={2026}
                    onRowsGetterReady={handleRowsGetterReady}
                />
            );
        });
        await flushEffects();

        const afterScopeChangeRows = rowsGetter();
        expect(afterScopeChangeRows.some((row) => row.type === 'employee' && row.nama === 'Budi Lama')).toBe(false);

        await act(async () => {
            root.unmount();
        });
        container.remove();
    });

    it('refreshes employee values when month changes even if row identities stay the same', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        let rowsGetter = () => [];
        const handleRowsGetterReady = vi.fn((getter) => {
            rowsGetter = getter;
        });

        mocked.streamState.current = buildStreamState({
            gangs: [buildGang({ gangCode: 'A1', employeeName: 'Budi', upahBersih: 100000 })],
            isComplete: true
        });

        await act(async () => {
            root.render(
                <CustomPayrollTable
                    token="token"
                    division="PG2A"
                    gangCode="ALL"
                    month={1}
                    year={2026}
                    onRowsGetterReady={handleRowsGetterReady}
                />
            );
        });
        await flushEffects();

        const beforeScopeChangeRows = rowsGetter();
        const beforeEmployee = beforeScopeChangeRows.find((row) => row.type === 'employee' && row.emp_code === 'A1-EMP');
        expect(beforeEmployee?.upah_bersih).toBe(100000);

        mocked.streamState.current = buildStreamState({
            gangs: [buildGang({ gangCode: 'A1', employeeName: 'Budi', upahBersih: 250000 })],
            isComplete: true
        });

        await act(async () => {
            root.render(
                <CustomPayrollTable
                    token="token"
                    division="PG2A"
                    gangCode="ALL"
                    month={2}
                    year={2026}
                    onRowsGetterReady={handleRowsGetterReady}
                />
            );
        });
        await flushEffects();

        const afterScopeChangeRows = rowsGetter();
        const afterEmployee = afterScopeChangeRows.find((row) => row.type === 'employee' && row.emp_code === 'A1-EMP');
        expect(afterEmployee?.upah_bersih).toBe(250000);

        await act(async () => {
            root.unmount();
        });
        container.remove();
    });
});
