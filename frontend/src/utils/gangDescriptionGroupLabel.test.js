import { describe, expect, it } from 'vitest';
import { buildGangDescriptionGroupLabel } from './gangDescriptionGroupLabel.js';

describe('buildGangDescriptionGroupLabel', () => {
  it('uses the shared meaningful suffix from repeated gang descriptions', () => {
    const label = buildGangDescriptionGroupLabel([
      { gang_code: 'A1H', gang_description: 'Gang Panen Air Papan' },
      { gang_code: 'A1M', gang_description: 'Gang Rawat Air Papan' }
    ], { fallbackLabel: 'Group 1' });

    expect(label).toBe('Air Papan');
  });

  it('cleans generic leading words when only one description exists', () => {
    const label = buildGangDescriptionGroupLabel([
      { gang_code: 'A2H', gang_description: 'Gang Pruning Bukit Batu' }
    ], { fallbackLabel: 'Group 2' });

    expect(label).toBe('Bukit Batu');
  });

  it('falls back when the description has no meaningful group name', () => {
    const label = buildGangDescriptionGroupLabel([
      { gang_code: 'A3H', gang_description: 'Gang Panen' }
    ], { fallbackLabel: 'Group 3' });

    expect(label).toBe('Group 3');
  });
});
