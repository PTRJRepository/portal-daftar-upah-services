import { describe, expect, it } from 'vitest';
import { resolveGangPrefixAfterAvailablePrefixesChange } from './payrollGangPrefixState';

describe('resolveGangPrefixAfterAvailablePrefixesChange', () => {
    it('keeps a user-selected group when the group exists in the loaded gangs', () => {
        expect(resolveGangPrefixAfterAvailablePrefixesChange({
            division: 'PG1A',
            gangPrefix: '2',
            availablePrefixes: ['1', '2', '3']
        })).toBe('2');
    });

    it('keeps all-groups scope when the user clears the group selector', () => {
        expect(resolveGangPrefixAfterAvailablePrefixesChange({
            division: 'PG1A',
            gangPrefix: '',
            availablePrefixes: ['1', '2', '3']
        })).toBe('');
    });

    it('clears a stale group when the new division does not have it', () => {
        expect(resolveGangPrefixAfterAvailablePrefixesChange({
            division: 'PG2A',
            gangPrefix: '4',
            availablePrefixes: ['1', '2']
        })).toBe('');
    });

    it('clears group scope for INFRA divisions', () => {
        expect(resolveGangPrefixAfterAvailablePrefixesChange({
            division: 'INFRA',
            gangPrefix: '1',
            availablePrefixes: ['1']
        })).toBe('');
    });
});
