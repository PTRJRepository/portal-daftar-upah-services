import { describe, expect, it } from 'vitest';
import { buildPayrollRequestScopeKey, resolveEffectiveGangPrefix } from './payrollRequestScope';

describe('resolveEffectiveGangPrefix', () => {
    it('drops gangPrefix when a specific gang is selected', () => {
        expect(resolveEffectiveGangPrefix('D1H', '1')).toBeNull();
    });

    it('keeps gangPrefix when scope is ALL gangs', () => {
        expect(resolveEffectiveGangPrefix('ALL', '1')).toBe('1');
        expect(resolveEffectiveGangPrefix(null, '1')).toBe('1');
    });

    it('drops gangPrefix for INFRA virtual division so INF and INT are not filtered out', () => {
        expect(resolveEffectiveGangPrefix('ALL', '1', 'INFRA')).toBeNull();
        expect(resolveEffectiveGangPrefix('ALL', '1', 'INF')).toBeNull();
    });
});

describe('buildPayrollRequestScopeKey', () => {
    it('does not change when only gangPrefix changes for a specific gang', () => {
        const keyA = buildPayrollRequestScopeKey({
            division: 'PG2B',
            month: 3,
            year: 2026,
            gangCode: 'D1H',
            gangPrefix: null,
            useHistoryDb: false,
            snapshotVersion: null
        });
        const keyB = buildPayrollRequestScopeKey({
            division: 'PG2B',
            month: 3,
            year: 2026,
            gangCode: 'D1H',
            gangPrefix: '1',
            useHistoryDb: false,
            snapshotVersion: null
        });

        expect(keyA).toBe(keyB);
    });

    it('changes when gangPrefix changes for all gangs scope', () => {
        const keyA = buildPayrollRequestScopeKey({
            division: 'PG2B',
            month: 3,
            year: 2026,
            gangCode: 'ALL',
            gangPrefix: null,
            useHistoryDb: false,
            snapshotVersion: null
        });
        const keyB = buildPayrollRequestScopeKey({
            division: 'PG2B',
            month: 3,
            year: 2026,
            gangCode: 'ALL',
            gangPrefix: '1',
            useHistoryDb: false,
            snapshotVersion: null
        });

        expect(keyA).not.toBe(keyB);
    });

    it('does not change when stale gangPrefix changes for INFRA virtual division', () => {
        const keyA = buildPayrollRequestScopeKey({
            division: 'INFRA',
            month: 3,
            year: 2026,
            gangCode: 'ALL',
            gangPrefix: null,
            useHistoryDb: false,
            snapshotVersion: null
        });
        const keyB = buildPayrollRequestScopeKey({
            division: 'INFRA',
            month: 3,
            year: 2026,
            gangCode: 'ALL',
            gangPrefix: '1',
            useHistoryDb: false,
            snapshotVersion: null
        });

        expect(keyA).toBe(keyB);
    });
});
