import { describe, expect, it } from 'vitest';
import { applyAction, beginHand, createInitialState, legalActions } from '../gameEngine';
import type { Card, Rank, Suit } from '../types';

const card = (rank: Rank, suit: Suit): Card => ({ rank, suit });

const setupState = (stacks: Partial<Record<number, number>>) => {
  const state = createInitialState();
  state.players.forEach((player) => {
    player.stack = stacks[player.seat] ?? 0;
  });
  return beginHand(state);
};

describe('game engine strict state machine', () => {
  it('handles open raise then fold with immediate award', () => {
    let state = setupState({ 0: 1000, 1: 1000 });
    state = applyAction(state, 1, 'raise', 300);
    state = applyAction(state, 0, 'fold');

    expect(state.summary?.winners).toEqual([{ seat: 1, name: 'Nit', amountWon: 400, winningCards: undefined }]);
    expect(state.summary?.handIntegrity).toBe('valid');
    expect(state.pot).toBe(0);
  });

  it('handles raise call then flop bet fold', () => {
    let state = setupState({ 0: 1500, 1: 1500 });
    state = applyAction(state, 1, 'raise', 300);
    state = applyAction(state, 0, 'call');
    expect(state.street).toBe('flop');
    expect(state.currentSeat).toBe(0);

    state = applyAction(state, 0, 'raise', 300);
    expect(state.actions[state.actions.length - 1]?.type).toBe('bet');
    state = applyAction(state, 1, 'fold');

    expect(state.summary?.showdown).toBe(false);
    expect(state.summary?.winners[0].seat).toBe(0);
    expect(state.summary?.handIntegrity).toBe('valid');
  });

  it('supports a heads-up 3-bet pot', () => {
    let state = setupState({ 0: 5000, 1: 5000 });
    state = applyAction(state, 1, 'raise', 300);
    state = applyAction(state, 0, 'raise', 900);
    state = applyAction(state, 1, 'call');

    expect(state.street).toBe('flop');
    expect(state.pot).toBe(1800);
    expect(state.currentBet).toBe(0);
    expect(state.summary).toBeUndefined();
  });

  it('handles multiway preflop fold call raise sequencing', () => {
    let state = setupState({ 0: 3000, 1: 3000, 2: 3000 });
    expect(state.currentSeat).toBe(1);

    state = applyAction(state, 1, 'call');
    expect(state.currentSeat).toBe(2);
    state = applyAction(state, 2, 'raise', 400);
    expect(state.currentSeat).toBe(0);
    state = applyAction(state, 0, 'fold');
    expect(state.currentSeat).toBe(1);
    state = applyAction(state, 1, 'call');

    expect(state.street).toBe('flop');
    expect(state.currentSeat).toBe(2);
  });

  it('keeps short all-ins from reopening action while still returning action to unmatched players', () => {
    let state = setupState({ 0: 3000, 1: 3000, 2: 450 });
    state = applyAction(state, 1, 'raise', 300);
    state = applyAction(state, 2, 'all_in');

    expect(state.currentSeat).toBe(0);
    state = applyAction(state, 0, 'fold');
    expect(state.currentSeat).toBe(1);
    const legal = legalActions(state, 1);
    expect(legal.toCall).toBe(150);
    expect(legal.canRaise).toBe(false);
  });

  it('marks showdown busts immediately and removes them from the next hand rotation', () => {
    let state = setupState({ 0: 2000, 1: 300 });
    state.players[0].holeCards = [card('A', '\u2660'), card('A', '\u2665')];
    state.players[1].holeCards = [card('K', '\u2663'), card('K', '\u2666')];
    state.deck = [card('J', '\u2663'), card('9', '\u2666'), card('7', '\u2660'), card('5', '\u2665'), card('2', '\u2663')];

    state = applyAction(state, 1, 'all_in');
    state = applyAction(state, 0, 'call');

    expect(state.summary?.showdown).toBe(true);
    expect(state.players[1].busted).toBe(true);
    expect(state.summary?.busts.map((entry) => entry.seat)).toContain(1);

    const next = beginHand(state);
    expect(next.activeSeatsAtHandStart).toEqual([0]);
    expect(next.currentSeat).toBe(-1);
  });

  it('skips busted seats for button and blind assignment', () => {
    const state = createInitialState();
    state.players[2].stack = 0;
    state.players[4].stack = 0;
    const started = beginHand(state);

    expect([started.dealer, started.smallBlindSeat, started.bigBlindSeat]).not.toContain(2);
    expect([started.dealer, started.smallBlindSeat, started.bigBlindSeat]).not.toContain(4);
    expect(started.activeSeatsAtHandStart).toEqual([0, 1, 3, 5]);
  });

  it('does not start a new hand when one player has chips left', () => {
    const state = createInitialState();
    state.players.forEach((player, index) => {
      player.stack = index === 0 ? 1000 : 0;
    });
    const started = beginHand(state);

    expect(started.handId).toBe(0);
    expect(started.currentSeat).toBe(-1);
    expect(started.waitingForHero).toBe(false);
  });

  it('closes a check-check street correctly', () => {
    let state = setupState({ 0: 2000, 1: 2000 });
    state = applyAction(state, 1, 'call');
    state = applyAction(state, 0, 'check');
    expect(state.street).toBe('flop');
    state = applyAction(state, 0, 'check');
    state = applyAction(state, 1, 'check');

    expect(state.street).toBe('turn');
  });

  it('closes a bet-call street correctly', () => {
    let state = setupState({ 0: 2000, 1: 2000 });
    state = applyAction(state, 1, 'call');
    state = applyAction(state, 0, 'check');
    state = applyAction(state, 0, 'raise', 300);
    state = applyAction(state, 1, 'call');

    expect(state.street).toBe('turn');
  });

  it('closes a bet-raise-call street correctly', () => {
    let state = setupState({ 0: 2500, 1: 2500 });
    state = applyAction(state, 1, 'call');
    state = applyAction(state, 0, 'check');
    state = applyAction(state, 0, 'raise', 300);
    state = applyAction(state, 1, 'raise', 900);
    state = applyAction(state, 0, 'call');

    expect(state.street).toBe('turn');
    expect(state.currentSeat).toBe(0);
  });

  it('prevents illegal same-player double actions', () => {
    let state = setupState({ 0: 1000, 1: 1000 });
    state = applyAction(state, 1, 'raise', 300);

    expect(() => applyAction(state, 1, 'call')).toThrow(/Illegal action/);
  });
});
