import { describe, expect, it } from 'vitest';
import { classifyBoardBucket } from '../buckets/boardBuckets';
import { classifyHandBucket } from '../buckets/handBuckets';

describe('strategy buckets', () => {
  it('classifies A-high dry board', () => {
    expect(classifyBoardBucket([
      { rank: 'A', suit: '♠' },
      { rank: '7', suit: '♥' },
      { rank: '2', suit: '♣' }
    ])).toBe('a-high-dry');
  });

  it('classifies monotone board', () => {
    expect(classifyBoardBucket([
      { rank: 'K', suit: '♠' },
      { rank: '9', suit: '♠' },
      { rank: '4', suit: '♠' }
    ])).toBe('monotone');
  });

  it('classifies bluff blocker bucket', () => {
    expect(classifyHandBucket(
      [{ rank: 'A', suit: '♠' }, { rank: '5', suit: '♥' }],
      [{ rank: '9', suit: '♣' }, { rank: '7', suit: '♦' }, { rank: '2', suit: '♣' }]
    )).toBe('bluff-blockers');
  });
});
