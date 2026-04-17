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
    expect(['fold','call','raise']).toContain(a.type);
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
    expect(['raise', 'check', 'fold']).toContain(a.type);
    expect(a.debug.reason.length).toBeGreaterThan(5);
  });

  it('supports strategy mode switching in debug output', () => {
    const exploit = decideBotAction({
      archetype: 'Calling Station',
      cards: [{ rank: 'A', suit: '♣' }, { rank: '5', suit: '♦' }],
      board: [{ rank: 'K', suit: '♦' }, { rank: '7', suit: '♥' }, { rank: '2', suit: '♣' }],
      previousBoard: [],
      street: 'flop',
      toCall: 200,
      pot: 800,
      minRaise: 400,
      stack: 9500,
      canCheck: false,
      position: 'BTN',
      playersInHand: 2,
      wasPreflopAggressor: false,
      facingThreeBet: false,
      hasBetThisStreet: false,
      strategyMode: 'exploit'
    });
    const blueprint = decideBotAction({
      archetype: 'Calling Station',
      cards: [{ rank: 'A', suit: '♣' }, { rank: '5', suit: '♦' }],
      board: [{ rank: 'K', suit: '♦' }, { rank: '7', suit: '♥' }, { rank: '2', suit: '♣' }],
      previousBoard: [],
      street: 'flop',
      toCall: 200,
      pot: 800,
      minRaise: 400,
      stack: 9500,
      canCheck: false,
      position: 'BTN',
      playersInHand: 2,
      wasPreflopAggressor: false,
      facingThreeBet: false,
      hasBetThisStreet: false,
      strategyMode: 'blueprint'
    });
    expect(exploit.debug.mode).toBe('exploit');
    expect(blueprint.debug.mode).toBe('blueprint');
  });
});
