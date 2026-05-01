/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import ReportToolbar from './ReportToolbar';

const { act } = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ReportToolbar gang filter', () => {
    let consoleLogSpy;

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    it('shows INF and INT for INFRA even when stale group prefix is present', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        await act(async () => {
            root.render(
                <ReportToolbar
                    division="INFRA"
                    divisions={[]}
                    month={4}
                    year={2026}
                    gangCode="ALL"
                    gangs={[
                        { gang_code: 'INF', description: 'Infrastruktur' },
                        { gang_code: 'INT', description: 'Infrastruktur T' },
                        { gang_code: 'IN1', description: 'Infrastruktur 1' }
                    ]}
                    gangPrefix="1"
                    onGangPrefixChange={() => {}}
                    onGangChange={() => {}}
                    onMonthYearChange={() => {}}
                />
            );
        });

        const selects = container.querySelectorAll('select');
        const groupSelect = selects[0];
        const gangSelect = selects[1];

        expect(Array.from(groupSelect.options).map(option => option.value)).toEqual(['']);
        expect(Array.from(gangSelect.options).map(option => option.value)).toEqual(['ALL', 'INF', 'INT', 'IN1']);

        await act(async () => {
            root.unmount();
        });
        container.remove();
    });

    it('keeps group switching available while table controls are loading', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        const handleGangPrefixChange = vi.fn();
        const handleGangChange = vi.fn();

        await act(async () => {
            root.render(
                <ReportToolbar
                    division="PG1A"
                    divisions={[]}
                    month={4}
                    year={2026}
                    gangCode="ALL"
                    gangs={[
                        { gang_code: 'A1H', description: 'Group 1' },
                        { gang_code: 'A2H', description: 'Group 2' }
                    ]}
                    gangPrefix="1"
                    onGangPrefixChange={handleGangPrefixChange}
                    onGangChange={handleGangChange}
                    onMonthYearChange={() => {}}
                    disableControls={true}
                />
            );
        });

        const selects = container.querySelectorAll('select');
        const groupSelect = selects[0];

        expect(groupSelect.disabled).toBe(false);

        await act(async () => {
            groupSelect.value = '2';
            groupSelect.dispatchEvent(new Event('change', { bubbles: true }));
        });

        expect(handleGangPrefixChange).toHaveBeenCalledWith('2');
        expect(handleGangChange).toHaveBeenCalledWith('ALL');

        await act(async () => {
            root.unmount();
        });
        container.remove();
    });
});
