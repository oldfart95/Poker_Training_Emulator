import { describe, expect, it } from 'vitest';
import { buildRangeSet, expandRangeToken, handToKey, inRange } from '../tuning/ranges';

describe('range parsing', () => {
  it('expands pair plus token', () => {
    expect(expandRangeToken('TT+')).toContain('AA');
    expect(expandRangeToken('TT+')).toContain('TT');
  });

  it('classifies suited and offsuit correctly', () => {
    const suited = handToKey([{ rank: 'A', suit: '♠' }, { rank: 'K', suit: '♠' }]);
    const offsuit = handToKey([{ rank: 'A', suit: '♠' }, { rank: 'K', suit: '♥' }]);
    expect(suited).toBe('AKs');
    expect(offsuit).toBe('AKo');
  });

  it('does position range lookup through set', () => {
    const set = buildRangeSet(['AKs', 'QQ+']);
    expect(inRange([{ rank: 'A', suit: '♠' }, { rank: 'K', suit: '♠' }], set)).toBe(true);
    expect(inRange([{ rank: 'A', suit: '♠' }, { rank: 'K', suit: '♥' }], set)).toBe(false);
  });
});
