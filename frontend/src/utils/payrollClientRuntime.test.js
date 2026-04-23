import { describe, expect, it } from 'vitest';
import { resolvePayrollClientRuntimePolicy } from './payrollClientRuntime';

describe('resolvePayrollClientRuntimePolicy', () => {
    it('does not mirror or publish stream data before the stream is complete', () => {
        expect(resolvePayrollClientRuntimePolicy({
            dataReady: true,
            hasRows: true,
            usesStream: true,
            streamComplete: false,
            hasPendingEdits: false,
            employeeCount: 120
        })).toEqual({
            shouldMirrorStreamRows: false,
            shouldPublishToParent: false,
            shouldPersistCache: false
        });
    });

    it('mirrors completed stream rows once and publishes final data to the parent', () => {
        expect(resolvePayrollClientRuntimePolicy({
            dataReady: true,
            hasRows: true,
            usesStream: true,
            streamComplete: true,
            hasPendingEdits: false,
            employeeCount: 120
        })).toEqual({
            shouldMirrorStreamRows: true,
            shouldPublishToParent: true,
            shouldPersistCache: true
        });
    });

    it('does not overwrite working rows when there are pending edits', () => {
        expect(resolvePayrollClientRuntimePolicy({
            dataReady: true,
            hasRows: true,
            usesStream: true,
            streamComplete: true,
            hasPendingEdits: true,
            employeeCount: 120
        })).toEqual({
            shouldMirrorStreamRows: false,
            shouldPublishToParent: true,
            shouldPersistCache: true
        });
    });

    it('skips local cache persistence for very large payloads', () => {
        expect(resolvePayrollClientRuntimePolicy({
            dataReady: true,
            hasRows: true,
            usesStream: true,
            streamComplete: true,
            hasPendingEdits: false,
            employeeCount: 950
        })).toEqual({
            shouldMirrorStreamRows: true,
            shouldPublishToParent: true,
            shouldPersistCache: false
        });
    });

    it('publishes legacy fetch data immediately once it is ready', () => {
        expect(resolvePayrollClientRuntimePolicy({
            dataReady: true,
            hasRows: true,
            usesStream: false,
            streamComplete: false,
            hasPendingEdits: false,
            employeeCount: 40
        })).toEqual({
            shouldMirrorStreamRows: false,
            shouldPublishToParent: true,
            shouldPersistCache: true
        });
    });
});
