import { describe, expect, it } from 'vitest';
import { compareHands, evaluateBestHand } from '../handEvaluator';

describe('hand evaluator', () => {
  it('detects straight flush', () => {
    const hand = evaluateBestHand([
      { rank: 'A', suit: '♠' }, { rank: 'K', suit: '♠' }, { rank: 'Q', suit: '♠' },
      { rank: 'J', suit: '♠' }, { rank: 'T', suit: '♠' }, { rank: '2', suit: '♦' }, { rank: '3', suit: '♣' }
    ]);
    expect(hand.rankName).toBe('Straight Flush');
  });

  it('compares pair vs high card', () => {
    const pair = evaluateBestHand([
      { rank: 'A', suit: '♠' }, { rank: 'A', suit: '♥' }, { rank: '7', suit: '♣' },
      { rank: '6', suit: '♦' }, { rank: '4', suit: '♣' }, { rank: '2', suit: '♦' }, { rank: '3', suit: '♣' }
    ]);
    const high = evaluateBestHand([
      { rank: 'K', suit: '♠' }, { rank: 'Q', suit: '♥' }, { rank: '7', suit: '♣' },
      { rank: '6', suit: '♦' }, { rank: '4', suit: '♣' }, { rank: '2', suit: '♦' }, { rank: '3', suit: '♣' }
    ]);
    expect(compareHands(pair, high)).toBeGreaterThan(0);
  });
});
