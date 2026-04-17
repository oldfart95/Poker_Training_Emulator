import { describe, expect, it } from 'vitest';
import { applyAction, beginHand, createInitialState } from '../gameEngine';
import { validateHand } from '../handValidator';

describe('hand validator', () => {
  it('accepts a valid completed hand', () => {
    const base = createInitialState();
    base.players.forEach((player, index) => {
      player.stack = index < 2 ? 1000 : 0;
    });

    let state = beginHand(base);
    state = applyAction(state, 1, 'raise', 300);
    state = applyAction(state, 0, 'fold');

    const result = validateHand({
      sb: state.sb,
      bb: state.bb,
      players: state.players,
      summary: state.summary!
    });

    expect(result.handIntegrity).toBe('valid');
    expect(result.integrityErrors).toHaveLength(0);
  });

  it('flags a tampered hand history', () => {
    const base = createInitialState();
    base.players.forEach((player, index) => {
      player.stack = index < 2 ? 1000 : 0;
    });

    let state = beginHand(base);
    state = applyAction(state, 1, 'raise', 300);
    state = applyAction(state, 0, 'fold');

    const brokenSummary = structuredClone(state.summary!);
    brokenSummary.actions[2].potAfter += 1;

    const result = validateHand({
      sb: state.sb,
      bb: state.bb,
      players: state.players,
      summary: brokenSummary
    });

    expect(result.handIntegrity).toBe('invalid');
    expect(result.integrityErrors.length).toBeGreaterThan(0);
  });
});
