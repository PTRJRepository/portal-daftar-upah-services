/** @vitest-environment jsdom */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { DeferredPayrollNumberInput } from './PayrollDeferredEditInput';

const { act } = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function setNativeInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('DeferredPayrollNumberInput', () => {
    it('keeps numeric keystrokes local and commits on blur', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const onCommit = vi.fn();

        try {
            await act(async () => {
                root.render(
                    <DeferredPayrollNumberInput
                        value={0}
                        emptyWhenZero
                        onCommit={onCommit}
                        aria-label="Premi insentif"
                    />
                );
            });

            const input = container.querySelector('input');
            expect(input).toBeTruthy();
            expect(input.type).toBe('text');
            expect(input.inputMode).toBe('decimal');
            expect(input.value).toBe('');

            await act(async () => {
                setNativeInputValue(input, '123');
            });

            expect(input.value).toBe('123');
            expect(onCommit).not.toHaveBeenCalled();

            await act(async () => {
                input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
            });

            expect(onCommit).toHaveBeenCalledTimes(1);
            expect(onCommit).toHaveBeenCalledWith('123');
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });

    it('commits with Enter and restores the last committed value with Escape', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const onCommit = vi.fn();

        try {
            await act(async () => {
                root.render(
                    <DeferredPayrollNumberInput
                        value={45}
                        onCommit={onCommit}
                        aria-label="Potongan"
                    />
                );
            });

            const input = container.querySelector('input');

            await act(async () => {
                setNativeInputValue(input, '78');
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            });

            expect(onCommit).toHaveBeenCalledWith('78');

            await act(async () => {
                setNativeInputValue(input, '999');
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            });

            expect(input.value).toBe('78');
            expect(onCommit).toHaveBeenCalledTimes(1);
        } finally {
            await act(async () => {
                root.unmount();
            });
            container.remove();
        }
    });
});
