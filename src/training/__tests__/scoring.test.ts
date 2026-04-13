import { describe, expect, it } from 'vitest';
import { evaluateBlindDefense, evaluateCBet, evaluatePreflop } from '../scoring';

describe('training scoring', () => {
  it('marks clear preflop open as best', () => {
    const result = evaluatePreflop(
      [{ rank: 'A', suit: '♠' }, { rank: 'K', suit: '♠' }],
      'open',
      { position: 'CO', facingOpen: false }
    );
    expect(result.verdict).toBe('Best');
    expect(result.scoreDelta).toBeGreaterThan(0);
    expect(result.evBand).toBe('Clear +EV');
  });

  it('allows acceptable mixed cbet decision', () => {
    const result = evaluateCBet(
      [{ rank: 'A', suit: '♠' }, { rank: 'Q', suit: '♣' }],
      [{ rank: 'K', suit: '♦' }, { rank: '7', suit: '♣' }, { rank: '2', suit: '♥' }],
      'check',
      { heroWasAggressor: true, potType: 'single-raised' }
    );
    expect(['Good', 'Okay', 'Best']).toContain(result.verdict);
    expect(result.boardTexture).toBeDefined();
    expect(['High', 'Medium', 'Low']).toContain(result.confidence);
  });

  it('punishes offsuit trash blind defense punts', () => {
    const result = evaluateBlindDefense(
      [{ rank: '8', suit: '♠' }, { rank: '3', suit: '♦' }],
      '3-bet',
      { heroSeat: 'SB', villainOpenPosition: 'BTN', openSizeBb: 2.5 }
    );
    expect(['Mistake', 'Punt']).toContain(result.verdict);
    expect(result.bestAction).toBe('FOLD');
  });

  it('produces different feedback language by strategy mode', () => {
    const blueprint = evaluateCBet(
      [{ rank: 'A', suit: '♠' }, { rank: 'Q', suit: '♣' }],
      [{ rank: 'K', suit: '♦' }, { rank: '7', suit: '♣' }, { rank: '2', suit: '♥' }],
      'check',
      { heroWasAggressor: true, potType: 'single-raised', strategyMode: 'blueprint', opponentProfile: 'Calling Station' }
    );
    const exploit = evaluateCBet(
      [{ rank: 'A', suit: '♠' }, { rank: 'Q', suit: '♣' }],
      [{ rank: 'K', suit: '♦' }, { rank: '7', suit: '♣' }, { rank: '2', suit: '♥' }],
      'check',
      { heroWasAggressor: true, potType: 'single-raised', strategyMode: 'exploit', opponentProfile: 'Calling Station' }
    );
    expect(blueprint.mode).toBe('blueprint');
    expect(exploit.mode).toBe('exploit');
    expect(exploit.shortExplanation).toContain('Against');
  });
});
