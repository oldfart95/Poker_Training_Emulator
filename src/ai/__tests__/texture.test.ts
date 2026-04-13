import { describe, expect, it } from 'vitest';
import { classifyBoardTexture } from '../tuning/boardTexture';

describe('board texture classification', () => {
  it('detects dry board', () => {
    const t = classifyBoardTexture([
      { rank: 'A', suit: '♠' },
      { rank: '7', suit: '♥' },
      { rank: '2', suit: '♦' }
    ]);
    expect(t.wetness).toBe('dry');
  });

  it('detects wet monotone connected board', () => {
    const t = classifyBoardTexture([
      { rank: '9', suit: '♠' },
      { rank: '8', suit: '♠' },
      { rank: '7', suit: '♠' }
    ]);
    expect(t.wetness).toBe('wet');
    expect(t.tone).toBe('monotone');
  });
});
