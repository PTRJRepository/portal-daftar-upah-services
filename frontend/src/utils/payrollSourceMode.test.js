import { describe, expect, it } from 'vitest';
import { getPayrollPeriodMode, resolveEffectiveUseHistoryDb } from './payrollSourceMode';

describe('resolveEffectiveUseHistoryDb', () => {
    it('forces history mode for historical periods', () => {
        expect(resolveEffectiveUseHistoryDb({ isHistoricalPeriod: true, useHistoryDb: false })).toBe(true);
    });

    it('keeps manual mode for non-historical periods', () => {
        expect(resolveEffectiveUseHistoryDb({ isHistoricalPeriod: false, useHistoryDb: false })).toBe(false);
        expect(resolveEffectiveUseHistoryDb({ isHistoricalPeriod: false, useHistoryDb: true })).toBe(true);
    });
});

describe('getPayrollPeriodMode', () => {
    it('treats earlier periods as historical when currentPeriod is not loaded yet', () => {
        expect(getPayrollPeriodMode({
            month: 3,
            year: 2026,
            currentPeriod: null,
            fallbackDate: new Date('2026-04-22T12:00:00Z')
        }).isHistoricalPeriod).toBe(true);
    });
});
