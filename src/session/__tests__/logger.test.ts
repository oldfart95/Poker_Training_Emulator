import { describe, expect, it } from 'vitest';
import { applyAction, beginHand, createInitialState, takeBotTurn } from '../../engine/gameEngine';
import { buildActionsCsv, buildHandsCsv, buildSessionJson } from '../exporters';
import { createSessionExport, createSessionRecord, recordStateTransition } from '../logger';
import type { SessionEnvironment } from '../types';

const environment: SessionEnvironment = {
  mode: 'full-ring',
  roomPolicy: 'exploit',
  pace: 'Normal'
};

describe('session logger', () => {
  it('captures a hand lifecycle and builds review exports', () => {
    const base = createInitialState();
    let sessionRecord = createSessionRecord(base, environment);
    let state = beginHand(base);

    sessionRecord = recordStateTransition(sessionRecord, base, state);

    while (!state.waitingForHero && !state.summary) {
      const previousState = state;
      state = takeBotTurn(state, environment.roomPolicy).state;
      sessionRecord = recordStateTransition(sessionRecord, previousState, state);
    }

    const heroTurn = state;
    state = applyAction(state, 0, 'fold');
    sessionRecord = recordStateTransition(sessionRecord, heroTurn, state);

    while (!state.summary) {
      const previousState = state;
      state = takeBotTurn(state, environment.roomPolicy).state;
      sessionRecord = recordStateTransition(sessionRecord, previousState, state);
    }

    const exported = createSessionExport(sessionRecord);

    expect(exported.hands).toHaveLength(1);
    expect(exported.summary.hands).toBe(1);
    expect(exported.schemaVersion).toBe('1.0.0');
    expect(exported.session.heroSeat).toBe(0);
    expect(exported.hands[0].heroSeat).toBe(0);
    expect(exported.hands[0].actions.some((action) => action.action === 'post_blind')).toBe(true);
    expect(exported.hands[0].result.heroFoldStreet).toBe('preflop');
    expect(buildHandsCsv(exported)).toContain('sessionId,handNumber,handId');
    expect(buildActionsCsv(exported)).toContain('post_blind');
    expect(buildSessionJson(exported)).toContain('"schemaVersion": "1.0.0"');
  });
});
