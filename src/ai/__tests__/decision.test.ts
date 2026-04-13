import { describe, expect, it } from 'vitest';
import { decideBotAction } from '../decision';

describe('action sanity', () => {
  it('nit usually folds junk facing raise preflop', () => {
    const a = decideBotAction({
      archetype: 'Nit',
      cards: [{ rank: '7', suit: '♣' }, { rank: '2', suit: '♦' }],
      board: [],
      previousBoard: [],
      street: 'preflop',
      toCall: 300,
      pot: 450,
      minRaise: 600,
      stack: 10000,
      canCheck: false,
      position: 'UTG',
      playersInHand: 6,
      wasPreflopAggressor: false,
      facingThreeBet: false,
      hasBetThisStreet: false
    });
    expect(['fold','call']).toContain(a.type);
    expect(a.debug.archetype).toBe('Nit');
  });

  it('maniac can find aggressive action more often', () => {
    const a = decideBotAction({
      archetype: 'Maniac',
      cards: [{ rank: 'A', suit: '♣' }, { rank: '5', suit: '♣' }],
      board: [{ rank: 'K', suit: '♦' }, { rank: '7', suit: '♥' }, { rank: '2', suit: '♣' }],
      previousBoard: [],
      street: 'flop',
      toCall: 0,
      pot: 900,
      minRaise: 300,
      stack: 9500,
      canCheck: true,
      position: 'BTN',
      playersInHand: 2,
      wasPreflopAggressor: true,
      facingThreeBet: false,
      hasBetThisStreet: false
    });
    expect(['raise','check']).toContain(a.type);
    expect(a.debug.reason.length).toBeGreaterThan(5);
  });
});
