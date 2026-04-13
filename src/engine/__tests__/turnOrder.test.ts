import { describe, expect, it } from 'vitest';
import { beginHand, createInitialState } from '../gameEngine';

describe('turn order', () => {
  it('starts preflop action left of big blind', () => {
    const s = beginHand(createInitialState());
    expect(s.currentSeat).toBe((s.dealer + 3) % 6);
  });

  it('posts blinds into pot', () => {
    const s = beginHand(createInitialState());
    expect(s.pot).toBe(s.sb + s.bb);
  });
});
