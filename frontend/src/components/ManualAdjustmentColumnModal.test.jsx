/** @vitest-environment jsdom */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

const { act } = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocked = vi.hoisted(() => ({
    fetchTaskCodeOptions: vi.fn(() => Promise.resolve({ success: true, data: [] })),
    fetchManualAdjustmentPresets: vi.fn(() => Promise.resolve({
        success: true,
        data: [
            {
                id: 7,
                adjustment_type: 'POTONGAN_KOTOR',
                adjustment_name: 'KOREKSI DENDA PANEN',
                ad_code: '',
                task_code: '',
                base_task_code: '',
                task_desc: '',
                division_code: 'PG2A',
                remarks_template: 'KOREKSI DENDA PANEN | DE0004 - (DE) POTONGAN PREMI | 0 | sync:MISS | match:MISMATCH'
            }
        ]
    })),
    createManualAdjustmentPreset: vi.fn(() => Promise.resolve({ success: true, id: 10 }))
}));

vi.mock('../services/manualAdjustmentService', () => ({
    fetchTaskCodeOptions: mocked.fetchTaskCodeOptions
}));

vi.mock('../services/manualAdjustmentPresetService', () => ({
    createManualAdjustmentPreset: mocked.createManualAdjustmentPreset,
    fetchManualAdjustmentPresets: mocked.fetchManualAdjustmentPresets
}));

import ManualAdjustmentColumnModal from './ManualAdjustmentColumnModal';

async function flushEffects() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

function findButton(container, text) {
    return Array.from(container.querySelectorAll('button')).find((button) =>
        (button.textContent || '').includes(text)
    );
}

function changeInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('ManualAdjustmentColumnModal', () => {
    beforeEach(() => {
        mocked.fetchTaskCodeOptions.mockClear();
        mocked.fetchManualAdjustmentPresets.mockClear();
        mocked.createManualAdjustmentPreset.mockClear();
        vi.useRealTimers();
    });

    it('loads all saved column presets without applying category or division filters', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        try {
            await act(async () => {
                root.render(
                    <ManualAdjustmentColumnModal
                        isOpen
                        onClose={() => {}}
                        onSaved={() => {}}
                        token="test-token"
                        division="PG2A"
                    />
                );
            });
            await flushEffects();

            expect(mocked.fetchManualAdjustmentPresets).toHaveBeenCalledWith('test-token', {});
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });

    it('uses ADCode parsed from preset remarks when the saved preset row has no ad_code field', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const onSaved = vi.fn();

        try {
            await act(async () => {
                root.render(
                    <ManualAdjustmentColumnModal
                        isOpen
                        onClose={() => {}}
                        onSaved={onSaved}
                        token="test-token"
                        division="PG2A"
                    />
                );
            });
            await flushEffects();

            const presetButton = findButton(container, 'KOREKSI DENDA PANEN');
            expect(presetButton).toBeTruthy();

            await act(async () => {
                presetButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
            await flushEffects();

            const saveButton = findButton(container, 'Simpan Kolom');
            expect(saveButton).toBeTruthy();

            await act(async () => {
                saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
            await flushEffects();

            expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
                adjustment_type: 'POTONGAN_KOTOR',
                adjustment_name: 'KOREKSI DENDA PANEN',
                ad_code: 'DE0004',
                task_desc: '(DE) POTONGAN PREMI',
                remarks: 'KOREKSI DENDA PANEN | DE0004 - (DE) POTONGAN PREMI | 0 | sync:MISS | match:MISMATCH'
            }));
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });

    it('does not search ADCode again while typing the column name', async () => {
        vi.useFakeTimers();
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        try {
            await act(async () => {
                root.render(
                    <ManualAdjustmentColumnModal
                        isOpen
                        onClose={() => {}}
                        onSaved={() => {}}
                        token="test-token"
                        division="PG2A"
                    />
                );
            });

            await act(async () => {
                vi.advanceTimersByTime(300);
            });
            await flushEffects();
            expect(mocked.fetchTaskCodeOptions).toHaveBeenCalledTimes(1);

            const nameInput = container.querySelector('input[placeholder="Ketik nama premi, contoh: PRUNING"]');
            expect(nameInput).toBeTruthy();

            await act(async () => {
                changeInputValue(nameInput, 'PREMI RAWAT');
            });
            await flushEffects();

            await act(async () => {
                vi.advanceTimersByTime(300);
            });
            await flushEffects();

            expect(mocked.fetchTaskCodeOptions).toHaveBeenCalledTimes(1);

            const adCodeInput = container.querySelector('input[placeholder*="Cari ADCode"]');
            expect(adCodeInput).toBeTruthy();
            expect(adCodeInput.value).toBe('');
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
            vi.useRealTimers();
        }
    });

    it('keeps the action buttons in a sticky modal footer', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        try {
            await act(async () => {
                root.render(
                    <ManualAdjustmentColumnModal
                        isOpen
                        onClose={() => {}}
                        onSaved={() => {}}
                        token="test-token"
                        division="PG2A"
                    />
                );
            });
            await flushEffects();

            const saveButton = findButton(container, 'Simpan Kolom');
            expect(saveButton).toBeTruthy();

            const footer = saveButton.parentElement;
            expect(footer.style.position).toBe('sticky');
            expect(footer.style.bottom).toBe('0px');
            expect(footer.style.flexShrink).toBe('0');
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });
});
