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
        actions: [{
          actionIndex: 0,
          timestamp: '2026-04-16T00:00:00.000Z',
          seat: 1,
          playerName: 'Nit Villain',
          street: 'preflop',
          type: 'raise',
          amount: 250,
          toAmount: 350,
          potBefore: 150,
          potAfter: 400,
          stackBefore: 1000,
          stackAfter: 750,
          amountToCallBefore: 100,
          amountToCallAfter: 0,
          isAllIn: false
        }],
        startingPot: 150,
        sb: 50,
        bb: 100,
        buttonSeat: 0,
        smallBlindSeat: 1,
        bigBlindSeat: 2,
        startingStacks: { '0': 1000, '1': 1000, '2': 1000 },
        endingStacks: { '0': 1000, '1': 750, '2': 900 },
        activePlayersAtStart: [0, 1, 2],
        activeSeatMap: [true, true, true, false, false, false],
        tableSizeAtStart: 3,
        showdown: false,
        winners: [],
        busts: [],
        handIntegrity: 'valid',
        integrityErrors: [],
        engineVersion: '2.0.0',
        resultChips: 0,
        resultBb: 0,
        rating: 'reasonable',
        feedback: '',
        why: '',
        tighter: '',
        aggressive: ''
      },
      [{ id: 'p1', name: 'Nit Villain', isHero: false, stack: 1000, holeCards: [], folded: false, allIn: false, betThisStreet: 0, totalContributed: 0, seat: 1, position: 'HJ', busted: false, profile: 'Nit' }],
      'exploit'
    );

    expect(steps[0].potAfter).toBe(400);
    expect(steps[0].interpretation.length).toBeGreaterThan(10);
    expect(steps[0].mode).toBe('exploit');
  });
});
