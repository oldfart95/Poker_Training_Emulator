import { describe, expect, it } from 'vitest';
import { nextDrillSpot } from '../drills';

describe('drill determinism', () => {
  it('returns repeatable drill spot for same seed/index', () => {
    const a = nextDrillSpot('preflop-trainer', { seed: 42, index: 3 });
    const b = nextDrillSpot('preflop-trainer', { seed: 42, index: 3 });

    expect(a?.prompt).toBe(b?.prompt);
    expect(a?.heroCards).toEqual(b?.heroCards);
    expect(a?.seedTag).toBe('42:3');
  });
});
