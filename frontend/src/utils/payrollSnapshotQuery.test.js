import { describe, expect, it } from 'vitest';
import {
    appendSnapshotVersionToObject,
    appendSnapshotVersionToSearchParams,
    buildPayrollSnapshotCacheKey,
    normalizeSnapshotVersion
} from './payrollSnapshotQuery';

describe('normalizeSnapshotVersion', () => {
    it('returns a positive integer when the value is valid', () => {
        expect(normalizeSnapshotVersion(3)).toBe(3);
        expect(normalizeSnapshotVersion(' 5 ')).toBe(5);
    });

    it('returns null for blank or unsupported values', () => {
        expect(normalizeSnapshotVersion('')).toBeNull();
        expect(normalizeSnapshotVersion('0')).toBeNull();
        expect(normalizeSnapshotVersion('-2')).toBeNull();
        expect(normalizeSnapshotVersion('abc')).toBeNull();
        expect(normalizeSnapshotVersion(undefined)).toBeNull();
    });
});

describe('appendSnapshotVersionToObject', () => {
    it('adds snapshot_version only when it is valid', () => {
        expect(appendSnapshotVersionToObject({ use_history: 'true' }, 4)).toEqual({
            use_history: 'true',
            snapshot_version: '4'
        });
        expect(appendSnapshotVersionToObject({ use_history: 'true' }, '')).toEqual({
            use_history: 'true'
        });
    });
});

describe('appendSnapshotVersionToSearchParams', () => {
    it('adds snapshot_version to URLSearchParams only when it is valid', () => {
        const params = new URLSearchParams('division_code=AB1');
        appendSnapshotVersionToSearchParams(params, '6');
        expect(params.toString()).toContain('snapshot_version=6');

        const blankParams = new URLSearchParams('division_code=AB1');
        appendSnapshotVersionToSearchParams(blankParams, '');
        expect(blankParams.toString()).toBe('division_code=AB1');
    });
});

describe('buildPayrollSnapshotCacheKey', () => {
    it('includes snapshot version in history cache keys', () => {
        expect(buildPayrollSnapshotCacheKey({
            division: 'AB1',
            month: 4,
            year: 2026,
            useHistory: true,
            snapshotVersion: 3
        })).toBe('payroll_cache_AB1_4_2026_hist_v3');
    });

    it('uses latest marker when history mode has no explicit snapshot version', () => {
        expect(buildPayrollSnapshotCacheKey({
            division: 'AB1',
            month: 4,
            year: 2026,
            useHistory: true,
            snapshotVersion: ''
        })).toBe('payroll_cache_AB1_4_2026_hist_latest');
    });
});
