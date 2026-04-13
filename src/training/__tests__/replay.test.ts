import { describe, expect, it } from 'vitest';
import { formatReplaySteps } from '../replay';

describe('replay formatting', () => {
  it('adds running pot and interpretations', () => {
    const steps = formatReplaySteps(
      {
        id: 1,
        heroCards: [],
        heroPosition: 'BTN',
        board: [],
        actions: [{ seat: 1, playerName: 'Nit Villain', street: 'preflop', type: 'raise', amount: 250 }],
        startingPot: 150,
        sb: 50,
        bb: 100,
        resultChips: 0,
        resultBb: 0,
        rating: 'reasonable',
        feedback: '',
        why: '',
        tighter: '',
        aggressive: ''
      },
      [{ id: 'p1', name: 'Nit Villain', isHero: false, stack: 1000, holeCards: [], folded: false, allIn: false, betThisStreet: 0, totalContributed: 0, seat: 1, position: 'HJ', profile: 'Nit' }],
      'exploit'
    );

    expect(steps[0].potAfter).toBe(400);
    expect(steps[0].interpretation.length).toBeGreaterThan(10);
    expect(steps[0].mode).toBe('exploit');
  });
});
