import { describe, expect, it } from 'vitest';
import { resolveManualDetailInputType } from './manualDetailInputType';

describe('resolveManualDetailInputType', () => {
    it('uses the latest premium definition input type before stale local column metadata', () => {
        expect(resolveManualDetailInputType({
            definition: { input_type: 'kendaraan' },
            addedColumn: { input_type: 'blok' },
            edit: { metadata_json: JSON.stringify({ input_type: 'blok' }) },
            storedMetadata: { input_type: 'blok' }
        })).toBe('kendaraan');
    });

    it('falls back to persisted metadata when no definition is available', () => {
        expect(resolveManualDetailInputType({
            storedMetadata: { input_type: 'exp' }
        })).toBe('exp');
    });
});
