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

    it('shows the reason when a pruning detail cell was marked red', () => {
        const html = renderToString(
            <PremiumDetailPopup
                isOpen
                onClose={() => {}}
                onSave={() => {}}
                inputType="blok"
                definitionName="PREMI RAKING"
                storedAmount={650000}
                mismatch={{
                    amount: 650000,
                    detail_total: 677650,
                    diff: 27650
                }}
                initialData={{
                    input_type: 'blok',
                    items: [{ subblok: 'P09/15', gang_code: 'D1H', jumlah: 677650 }],
                    total_amount: 677650
                }}
            />
        );

        expect(html).toContain('Alasan tanda merah');
        expect(html).toContain('total detail terbaru');
        expect(html).toContain('650.000');
        expect(html).toContain('677.650');
        expect(html).toContain('Saat disimpan, amount akan mengikuti total detail terbaru');
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

    it('defaults blok detail gang code from the current gang and reuses it for new rows', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        try {
            await act(async () => {
                root.render(
                    <PremiumDetailPopup
                        isOpen
                        onClose={() => {}}
                        onSave={() => {}}
                        inputType="blok"
                        definitionName="PREMI PRUNING"
                        defaultGangCode="D1H"
                    />
                );
            });

            const gangInputs = () => Array.from(container.querySelectorAll('input[placeholder="B1H"]'));
            expect(gangInputs().map((input) => input.value)).toEqual(['D1H']);

            const addButton = findButton(container, '+ Tambah Baris');
            expect(addButton).toBeTruthy();

            await act(async () => {
                addButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });

            expect(gangInputs().map((input) => input.value)).toEqual(['D1H', 'D1H']);
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });

    it('marks structured detail inputs as incomplete when required fields are still partial', () => {
        const html = renderToString(
            <PremiumDetailPopup
                isOpen
                onClose={() => {}}
                onSave={() => {}}
                inputType="kendaraan"
                definitionName="PREMI RITASE"
                storedAmount={150000}
                initialData={{
                    input_type: 'kendaraan',
                    items: [{ nomor_kendaraan: '', expense_code: 'ANGKUT', jumlah: 150000 }],
                    total_amount: 150000
                }}
            />
        );

        expect(html).toContain('Data detail belum lengkap');
        expect(html).toContain('nomor kendaraan wajib diisi');
        expect(html).toContain('border-color:#ef4444');
        expect(html).toContain('disabled=""');
    });

    it('keeps kendaraan expense as free text so users can enter the available code first', async () => {
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
                        inputType="kendaraan"
                        definitionName="KOREKSI ANGKUT"
                        storedAmount={150000}
                        initialData={{
                            input_type: 'kendaraan',
                            items: [{ nomor_kendaraan: 'B1234AB', expense_code: 'ANGKUT', jumlah: 150000 }],
                            total_amount: 150000
                        }}
                    />
                );
            });

            const expenseInput = container.querySelector('input[name="expense_code"]');
            expect(expenseInput).toBeTruthy();
            expect(expenseInput.value).toBe('ANGKUT');
            expect(container.querySelector('select[name="expense_code"]')).toBeFalsy();
            expect(container.textContent || '').not.toContain('expense code harus HELPER atau DRIVER');

            const saveButton = findButton(container, 'Simpan Detail');
            expect(saveButton.disabled).toBe(false);

            await act(async () => {
                saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });

            expect(onSave).toHaveBeenCalledTimes(1);
            expect(onSave.mock.calls[0][0]).toEqual(expect.objectContaining({
                input_type: 'kendaraan',
                items: [{ nomor_kendaraan: 'B1234AB', expense_code: 'ANGKUT', jumlah: 150000 }],
                total_amount: 150000
            }));
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });

    it('renders stale blok+expense metadata as blok-only when the configured input type is blok', async () => {
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
                        definitionName="PREMI INSENTIF"
                        storedAmount={100000}
                        initialData={{
                            input_type: 'blok,exp',
                            blok_items: [{ subblok: 'P09/15', gang_code: 'D1H', jumlah: 80000 }],
                            expense: { expense_code: 'ANGKUT', jumlah: 20000 },
                            total_amount: 100000
                        }}
                    />
                );
            });

            expect(container.textContent || '').toContain('Detail Blok');
            expect(container.textContent || '').not.toContain('Expense');
            expect(container.querySelector('input[value="P09/15"]')).toBeTruthy();

            const saveButton = findButton(container, 'Simpan Detail');
            expect(saveButton.disabled).toBe(false);

            await act(async () => {
                saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });

            expect(onSave).toHaveBeenCalledTimes(1);
            expect(onSave.mock.calls[0][0]).toEqual({
                input_type: 'blok',
                items: [{ subblok: 'P09/15', gang_code: 'D1H', jumlah: 80000 }],
                total_amount: 80000
            });
            expect(onSave.mock.calls[0][1]).toBe(100000);
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });

    it('accepts negative potongan detail values and saves the positive calculation total', async () => {
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
                        inputType="exp"
                        definitionName="POTONGAN LAINNYA KASBON"
                        adjustmentType="POTONGAN_BERSIH"
                        storedAmount={-7000}
                        initialData={{
                            input_type: 'exp',
                            expense_code: 'KASBON',
                            jumlah: -7000,
                            total_amount: -7000
                        }}
                    />
                );
            });

            expect(container.textContent || '').not.toContain('Jumlah expense wajib lebih dari 0');
            expect(container.textContent || '').toContain('7.000');

            const saveButton = findButton(container, 'Simpan Detail');
            expect(saveButton.disabled).toBe(false);

            await act(async () => {
                saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });

            expect(onSave).toHaveBeenCalledTimes(1);
            expect(onSave.mock.calls[0][0]).toEqual(expect.objectContaining({
                input_type: 'exp',
                expense_code: 'KASBON',
                jumlah: 7000,
                total_amount: 7000
            }));
            expect(onSave.mock.calls[0][1]).toBe(7000);
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
