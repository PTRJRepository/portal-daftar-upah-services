/** @vitest-environment jsdom */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

const { act } = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocked = vi.hoisted(() => ({
    fetchTaskCodeOptions: vi.fn(() => Promise.resolve({ success: true, data: [] })),
    fetchPremiumDefinitions: vi.fn(() => Promise.resolve({
        success: true,
        data: [
            {
                adjustment_name: 'PREMI PRUNING',
                ad_code: 'AL3PM0601',
                task_desc: '(AL) TUNJANGAN PREMI ((PM) PRUNING)',
                input_type: 'blok',
                is_active: true
            },
            {
                adjustment_name: 'PREMI RAKING',
                ad_code: 'AL3PM0602',
                task_desc: '(AL) TUNJANGAN PREMI ((PM) WEEDING - CIRCLE RAKING)',
                input_type: 'blok',
                is_active: true
            },
            {
                adjustment_type: 'POTONGAN_KOTOR',
                adjustment_name: 'KOREKSI X',
                ad_code: 'DE0004',
                task_desc: '(DE) POTONGAN PREMI',
                input_type: 'blok',
                is_active: true
            },
            {
                adjustment_type: 'POTONGAN_BERSIH',
                adjustment_name: 'POTONGAN X',
                ad_code: 'DE0002',
                task_desc: '(DE) POTONGAN HUTANG',
                input_type: 'amount',
                is_active: true
            }
        ]
    })),
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
    fetchTaskCodeOptions: mocked.fetchTaskCodeOptions,
    fetchPremiumDefinitions: mocked.fetchPremiumDefinitions
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
        mocked.fetchPremiumDefinitions.mockClear();
        mocked.fetchManualAdjustmentPresets.mockClear();
        mocked.createManualAdjustmentPreset.mockClear();
        vi.useRealTimers();
    });

    it('does not load or show database presets while using the PREMI definition list', async () => {
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

            expect(mocked.fetchManualAdjustmentPresets).not.toHaveBeenCalled();
            expect(container.textContent || '').not.toContain('Preset Kolom Tersimpan');
            expect(container.textContent || '').not.toContain('KOREKSI DENDA PANEN');
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });

    it('loads KOREKSI X template from premium definitions for non-PREMI categories', async () => {
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
                        initialAdjustmentType="POTONGAN_KOTOR"
                    />
                );
            });
            await flushEffects();

            expect(mocked.fetchPremiumDefinitions).toHaveBeenCalledWith('test-token');
            expect(mocked.fetchManualAdjustmentPresets).not.toHaveBeenCalled();
            expect(container.textContent || '').toContain('KOREKSI X');
            expect(container.textContent || '').toContain('Ganti X pada KOREKSI X');
            expect(container.textContent || '').toContain('(DE) POTONGAN PREMI');
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });

    it('saves another koreksi column name while keeping the template TaskDesc', async () => {
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
                        initialAdjustmentType="POTONGAN_KOTOR"
                    />
                );
            });
            await flushEffects();

            const nameInput = container.querySelector('input[placeholder="contoh: PANEN"]');
            expect(nameInput).toBeTruthy();

            await act(async () => {
                changeInputValue(nameInput, 'DENDA PANEN');
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
                task_code: 'DE0004',
                base_task_code: 'DE0004',
                task_desc: '(DE) POTONGAN PREMI',
                input_type: 'blok',
                remarks: 'KOREKSI DENDA PANEN | DE0004 - (DE) POTONGAN PREMI | 0 | sync:MISS | match:MISMATCH'
            }));
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });

    it('saves free-text koreksi with fixed prefix, ADCode, and blok input type', async () => {
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
                        initialAdjustmentType="POTONGAN_KOTOR"
                    />
                );
            });
            await flushEffects();

            const nameInput = container.querySelector('input[placeholder="contoh: PANEN"]');
            expect(nameInput).toBeTruthy();

            await act(async () => {
                changeInputValue(nameInput, 'PANEN');
            });
            await flushEffects();

            expect(container.textContent || '').toContain('DE0004');
            expect(container.textContent || '').toContain('(DE) POTONGAN PREMI');

            const saveButton = findButton(container, 'Simpan Kolom');
            expect(saveButton).toBeTruthy();
            expect(saveButton.disabled).toBe(false);

            await act(async () => {
                saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
            await flushEffects();

            expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
                adjustment_type: 'POTONGAN_KOTOR',
                adjustment_name: 'KOREKSI PANEN',
                ad_code: 'DE0004',
                task_desc: '(DE) POTONGAN PREMI',
                input_type: 'blok',
                remarks: 'KOREKSI PANEN | DE0004 - (DE) POTONGAN PREMI | 0 | sync:MISS | match:MISMATCH'
            }));
            expect(mocked.fetchTaskCodeOptions).not.toHaveBeenCalled();
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });

    it('uses premium definitions as the only selectable PREMI category source', async () => {
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

            const nameInput = container.querySelector('input[placeholder="Ketik nama premi, contoh: PRUNING"]');
            expect(nameInput).toBeFalsy();
            const adCodeInput = container.querySelector('input[placeholder*="Cari ADCode"]');
            expect(adCodeInput).toBeFalsy();

            const saveButton = findButton(container, 'Simpan Kolom');
            expect(saveButton).toBeTruthy();
            expect(saveButton.disabled).toBe(true);

            const pruningButton = findButton(container, 'PREMI PRUNING');
            expect(pruningButton).toBeTruthy();

            await act(async () => {
                pruningButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
            await flushEffects();

            await act(async () => {
                saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
            await flushEffects();

            expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
                adjustment_type: 'PREMI',
                adjustment_name: 'PREMI PRUNING',
                ad_code: 'AL3PM0601',
                task_desc: '(AL) TUNJANGAN PREMI ((PM) PRUNING)',
                input_type: 'blok'
            }));
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });

    it('saves column-level ADCode and AD_DESC override instead of the selected definition values', async () => {
        mocked.fetchPremiumDefinitions.mockResolvedValueOnce({
            success: true,
            data: [
                {
                    adjustment_name: 'PREMI ANGKUT TBS',
                    ad_code: 'AL3PT2305',
                    task_desc: '(AL) TUNJANGAN PREMI ANGKUT',
                    input_type: 'kendaraan',
                    is_active: true
                }
            ]
        });

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
                        division="AB1"
                    />
                );
            });
            await flushEffects();

            const angkutButton = findButton(container, 'PREMI ANGKUT TBS');
            expect(angkutButton).toBeTruthy();

            await act(async () => {
                angkutButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
            await flushEffects();

            const overrideToggle = Array.from(container.querySelectorAll('input[type="checkbox"]'))
                .find((input) => input.closest('label')?.textContent?.includes('Override ADCode/AD_DESC'));
            expect(overrideToggle).toBeTruthy();

            await act(async () => {
                overrideToggle.checked = true;
                overrideToggle.dispatchEvent(new Event('change', { bubbles: true }));
            });
            await flushEffects();

            const adCodeInput = container.querySelector('input[name="ad_code_override"]');
            const adDescInput = container.querySelector('input[name="ad_desc_override"]');
            expect(adCodeInput).toBeTruthy();
            expect(adDescInput).toBeTruthy();

            await act(async () => {
                changeInputValue(adCodeInput, 'AL9999AB1');
                changeInputValue(adDescInput, 'SIMPANG TIGA');
            });
            await flushEffects();

            const saveButton = findButton(container, 'Simpan Kolom');
            expect(saveButton.disabled).toBe(false);

            await act(async () => {
                saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
            await flushEffects();

            expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
                adjustment_type: 'PREMI',
                adjustment_name: 'PREMI ANGKUT TBS',
                ad_code: 'AL9999AB1',
                task_code: 'AL9999AB1',
                base_task_code: 'AL9999AB1',
                task_desc: 'SIMPANG TIGA',
                input_type: 'kendaraan',
                remarks: 'PREMI ANGKUT TBS | AL9999AB1 - SIMPANG TIGA | 0 | sync:MISS | match:MISMATCH'
            }));
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });

    it('filters premium definitions with local search instead of database presets', async () => {
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

            const searchInput = container.querySelector('input[placeholder="Cari nama, ADCode, TaskDesc, atau input type..."]');
            expect(searchInput).toBeTruthy();

            await act(async () => {
                changeInputValue(searchInput, 'raking');
            });
            await flushEffects();

            expect(container.textContent || '').toContain('PREMI RAKING');
            expect(container.textContent || '').not.toContain('PREMI PRUNING');
            expect(mocked.fetchManualAdjustmentPresets).not.toHaveBeenCalled();
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
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
