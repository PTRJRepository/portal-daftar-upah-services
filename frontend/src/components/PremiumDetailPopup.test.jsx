/** @vitest-environment jsdom */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import PremiumDetailPopup from './PremiumDetailPopup';

const { act } = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function findButton(container, text) {
    return Array.from(container.querySelectorAll('button')).find((button) =>
        (button.textContent || '').includes(text)
    );
}

describe('PremiumDetailPopup', () => {
    it('explains legacy fallback details when metadata was built from the stored amount', () => {
        const html = renderToString(
            <PremiumDetailPopup
                isOpen
                onClose={() => {}}
                onSave={() => {}}
                inputType="blok"
                definitionName="PREMI PRUNING"
                storedAmount={382800}
                initialData={{
                    input_type: 'blok',
                    items: [{ subblok: '', gang_code: 'D1H', jumlah: 382800 }],
                    total_amount: 382800,
                    legacy_source: true
                }}
            />
        );

        expect(html).toContain('Detail belum tersimpan di database');
        expect(html).toContain('fallback dari amount awal');
        expect(html).toContain('382.800');
    });

    it('shows old amount as info only for pruning detail and marks latest detail as the saved value', () => {
        const html = renderToString(
            <PremiumDetailPopup
                isOpen
                onClose={() => {}}
                onSave={() => {}}
                inputType="blok"
                definitionName="PREMI PRUNING"
                storedAmount={650000}
                initialData={{
                    input_type: 'blok',
                    items: [{ subblok: 'P09/15', gang_code: 'D1H', jumlah: 677650 }],
                    total_amount: 677650
                }}
            />
        );

        expect(html).toContain('Total amount awal');
        expect(html).toContain('650.000');
        expect(html).toContain('Total detail terbaru');
        expect(html).toContain('Dipakai saat simpan');
        expect(html).toContain('677.650');
        expect(html).toContain('Selisih');
        expect(html).toContain('27.650');
        expect(html).not.toContain('Amount tersimpan berbeda');
        expect(html).not.toContain('Sync ke Total Detail');
    });

    it('ignores zero old amount for pruning detail and only highlights the latest detail total', () => {
        const html = renderToString(
            <PremiumDetailPopup
                isOpen
                onClose={() => {}}
                onSave={() => {}}
                inputType="blok"
                definitionName="PREMI PRUNING"
                storedAmount={0}
                initialData={{
                    input_type: 'blok',
                    items: [{ subblok: 'P09/15', gang_code: 'D1H', jumlah: 677650 }],
                    total_amount: 677650
                }}
            />
        );

        expect(html).toContain('Amount awal kosong, total detail terbaru akan dipakai');
        expect(html).toContain('Total detail terbaru');
        expect(html).toContain('677.650');
        expect(html).not.toContain('Selisih');
        expect(html).not.toContain('Amount tersimpan berbeda');
    });

    it('does not show old-vs-detail verification for non pruning/raking premium detail', () => {
        const html = renderToString(
            <PremiumDetailPopup
                isOpen
                onClose={() => {}}
                onSave={() => {}}
                inputType="blok"
                definitionName="PREMI TBS"
                storedAmount={650000}
                initialData={{
                    input_type: 'blok',
                    items: [{ subblok: 'P09/15', gang_code: 'D1H', jumlah: 677650 }],
                    total_amount: 677650
                }}
            />
        );

        expect(html).toContain('Total detail terbaru');
        expect(html).toContain('677.650');
        expect(html).not.toContain('Total amount awal');
        expect(html).not.toContain('Selisih');
        expect(html).not.toContain('Amount tersimpan berbeda');
        expect(html).not.toContain('Edit amount awal/tersimpan');
        expect(html).not.toContain('Sync ke Total Detail');
        expect(html).toContain('Amount simpan manual');
    });

    it('saves pruning detail with amount automatically synced to the detail total', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const onSave = vi.fn();

        try {
            await act(async () => {
                root.render(
                    <PremiumDetailPopup
                        isOpen
                        onClose={() => {}}
                        onSave={onSave}
                        inputType="blok"
                        definitionName="PREMI PRUNING"
                        storedAmount={650000}
                        initialData={{
                            input_type: 'blok',
                            items: [{ subblok: 'P09/15', gang_code: 'D1H', jumlah: 677650 }],
                            total_amount: 677650
                        }}
                    />
                );
            });

            expect(findButton(container, 'Sync ke Total Detail')).toBeFalsy();
            expect(container.textContent || '').not.toContain('Edit amount awal/tersimpan');

            const saveButton = findButton(container, 'Simpan Detail');
            expect(saveButton).toBeTruthy();

            await act(async () => {
                saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });

            expect(onSave).toHaveBeenCalledTimes(1);
            expect(onSave.mock.calls[0][0]).toEqual(expect.objectContaining({
                input_type: 'blok',
                total_amount: 677650
            }));
            expect(onSave.mock.calls[0][1]).toBe(677650);
            expect(onSave.mock.calls[0][2]).toEqual(expect.objectContaining({
                amountSyncedToDetail: true
            }));
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });

    it('renders detail metadata as read-only when editing is disabled', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const onSave = vi.fn();

        try {
            await act(async () => {
                root.render(
                    <PremiumDetailPopup
                        isOpen
                        readOnly
                        onClose={() => {}}
                        onSave={onSave}
                        inputType="blok"
                        definitionName="PREMI PRUNING"
                        storedAmount={650000}
                        initialData={{
                            input_type: 'blok',
                            items: [{ subblok: 'P09/15', gang_code: 'D1H', jumlah: 677650 }],
                            total_amount: 677650
                        }}
                    />
                );
            });

            expect(container.textContent || '').toContain('Mode lihat saja');
            expect(findButton(container, 'Sync ke Total Detail')).toBeFalsy();
            expect(findButton(container, 'Simpan Detail')).toBeFalsy();
            expect(container.querySelector('input[type="checkbox"]')).toBeFalsy();
            expect(Array.from(container.querySelectorAll('input')).every((input) => input.disabled)).toBe(true);
            expect(onSave).not.toHaveBeenCalled();
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });
});
