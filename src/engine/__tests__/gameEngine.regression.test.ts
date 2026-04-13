import { describe, expect, it } from 'vitest';
import { applyAction, beginHand, createInitialState } from '../gameEngine';

describe('game engine regressions', () => {
  it('awards fold-out pots once and closes the hand', () => {
    const started = beginHand(createInitialState());
    started.players.forEach((p) => {
      p.folded = p.seat !== 0 && p.seat !== 1;
    });
    started.currentSeat = 1;

    const ended = applyAction(started, 1, 'fold');
    const totalChips = ended.players.reduce((sum, p) => sum + p.stack, 0);

    expect(ended.summary).toBeDefined();
    expect(ended.pot).toBe(0);
    expect(totalChips).toBe(60000);
    expect(ended.summary?.resultChips).toBe(started.sb + started.bb);
  });

  it('uses hero stack at hand start for per-hand result deltas', () => {
    const state = createInitialState();
    state.players[0].stack = 12000;
    const started = beginHand(state);
    started.players.forEach((p) => {
      p.folded = p.seat !== 0 && p.seat !== 1;
    });
    started.currentSeat = 1;

    const ended = applyAction(started, 1, 'fold');

    expect(ended.summary?.resultChips).toBe(started.sb + started.bb);
    expect(ended.summary?.resultBb).toBe((started.sb + started.bb) / started.bb);
    expect(ended.stats.winLossBb).toBe((started.sb + started.bb) / started.bb);
  });

  it('tracks starting pot from actual blind collections when blind is short-stacked', () => {
    const state = createInitialState();
    state.players[3].stack = 30;
    const started = beginHand(state);
    started.players.forEach((p) => {
      p.folded = p.seat !== 0 && p.seat !== 1;
    });
    started.currentSeat = 1;

    const ended = applyAction(started, 1, 'fold');

    expect(ended.summary?.startingPot).toBe(started.sb + Math.min(started.bb, 30));
  });
});
