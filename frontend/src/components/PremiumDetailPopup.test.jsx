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

        expect(html).toContain('Detail belum tersedia di database');
        expect(html).toContain('fallback dari amount awal');
        expect(html).toContain('382.800');
    });

    it('shows verification between stored amount and metadata detail total', () => {
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
        expect(html).toContain('Total detail');
        expect(html).toContain('677.650');
        expect(html).toContain('Selisih');
        expect(html).toContain('27.650');
    });

    it('saves the synced amount only after the sync button is used', async () => {
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

            const syncButton = findButton(container, 'Sync ke Total Detail');
            expect(syncButton).toBeTruthy();

            await act(async () => {
                syncButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });

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
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });
});
