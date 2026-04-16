import type { GameState } from '../engine/gameEngine';
import type { Card, Player, Street } from '../engine/types';
import type {
  SessionActionEvent,
  SessionCoachHint,
  SessionEnvironment,
  SessionExport,
  SessionHandLog,
  SessionRecord,
  SessionSummary
} from './types';
import { SESSION_FORMAT_VERSION } from './types';

const HERO_SEAT = 0;
const DEALER_SEAT = -1;

const nowIso = () => new Date().toISOString();
const cardCode = (card: Card) => `${card.rank}${card.suit}`;
const cardsCode = (cards: Card[]) => cards.map(cardCode);
const stackMap = (players: Player[], includeCommitted = false) => Object.fromEntries(
  players.map((player) => [String(player.seat), player.stack + (includeCommitted ? player.totalContributed : 0)])
);
const activePlayersAtStart = (players: Player[]) => players
  .map((player) => ({
    seat: player.seat,
    name: player.name,
    position: player.position,
    isHero: player.isHero,
    stack: player.stack + player.totalContributed
  }))
  .filter((player) => player.stack > 0);
const clone = <T,>(value: T): T => structuredClone(value);
const formatStrategyMode = (mode: SessionEnvironment['roomPolicy']) => mode;

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ppp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const nextActionIndex = (hand: SessionHandLog) => hand.actions.length;

const pushAction = (hand: SessionHandLog, action: Omit<SessionActionEvent, 'actionIndex'>) => {
  hand.actions.push({
    actionIndex: nextActionIndex(hand),
    ...action
  });
};

const heroFoldStreet = (hand: SessionHandLog): Street | null => {
  const fold = hand.actions.find((action) => action.actorSeat === HERO_SEAT && action.action === 'fold');
  return fold?.street ?? null;
};

const deriveSummary = (record: SessionRecord): SessionSummary => {
  const completedHands = record.hands.filter((hand) => hand.status === 'completed');
  const heroPreflopInvolvement = completedHands.filter((hand) => hand.activePlayersAtStart.some((player) => player.seat === HERO_SEAT));
  const vpipCount = completedHands.filter((hand) => hand.actions.some((action) => (
    action.actorSeat === HERO_SEAT
    && action.street === 'preflop'
    && (action.action === 'call' || action.action === 'raise' || action.action === 'all-in')
  ))).length;
  const pfrCount = completedHands.filter((hand) => hand.actions.some((action) => (
    action.actorSeat === HERO_SEAT
    && action.street === 'preflop'
    && (action.action === 'raise' || action.action === 'all-in')
  ))).length;
  const wtsdCount = completedHands.filter((hand) => hand.result.showdown && hand.result.heroInvolved && !hand.result.heroFoldStreet).length;
  const aggressiveActions = completedHands.flatMap((hand) => hand.actions).filter((action) => (
    action.actorSeat === HERO_SEAT && (action.action === 'bet' || action.action === 'raise' || action.action === 'all-in')
  )).length;
  const passiveCalls = completedHands.flatMap((hand) => hand.actions).filter((action) => (
    action.actorSeat === HERO_SEAT && action.action === 'call'
  )).length;
  const heroResults = completedHands.map((hand) => hand.result.heroResultBb ?? 0);
  const eliminations = completedHands.reduce((count, hand) => count + hand.busts.length, 0);

  return {
    hands: completedHands.length,
    netBb: Number(heroResults.reduce((sum, value) => sum + value, 0).toFixed(2)),
    vpip: heroPreflopInvolvement.length ? Number(((vpipCount / heroPreflopInvolvement.length) * 100).toFixed(2)) : 0,
    pfr: heroPreflopInvolvement.length ? Number(((pfrCount / heroPreflopInvolvement.length) * 100).toFixed(2)) : 0,
    wtsd: completedHands.length ? Number(((wtsdCount / completedHands.length) * 100).toFixed(2)) : 0,
    aggression: aggressiveActions + passiveCalls > 0
      ? Number(((aggressiveActions / (aggressiveActions + passiveCalls)) * 100).toFixed(2))
      : 0,
    bestHandBb: heroResults.length ? Number(Math.max(...heroResults).toFixed(2)) : 0,
    worstHandBb: heroResults.length ? Number(Math.min(...heroResults).toFixed(2)) : 0,
    eliminations
  };
};

const ensureCurrentHand = (record: SessionRecord, handNumber: number) => record.hands.find((hand) => hand.handNumber === handNumber);

const createHandLog = (state: GameState, timestamp: string): SessionHandLog => {
  const smallBlindSeat = (state.dealer + 1) % state.players.length;
  const bigBlindSeat = (state.dealer + 2) % state.players.length;
  const hand: SessionHandLog = {
    handNumber: state.handId,
    handId: `${state.handId}-${createId()}`,
    status: 'active',
    startedAt: timestamp,
    endedAt: null,
    buttonSeat: state.dealer,
    smallBlindSeat,
    bigBlindSeat,
    activePlayersAtStart: activePlayersAtStart(state.players),
    startingStacks: stackMap(state.players, true),
    heroHoleCards: cardsCode(state.players[HERO_SEAT]?.holeCards ?? []),
    revealedHoleCards: [],
    board: { flop: [], turn: null, river: null },
    actions: [],
    endingStacks: null,
    busts: [],
    coachHints: [],
    result: {
      showdown: false,
      winnerSeats: [],
      winners: [],
      heroInvolved: state.players[HERO_SEAT]?.stack + state.players[HERO_SEAT]?.totalContributed > 0,
      heroWon: false,
      heroFoldStreet: null,
      heroResultChips: null,
      heroResultBb: null,
      potFinal: null
    },
    notes: []
  };

  pushAction(hand, {
    timestamp,
    street: 'preflop',
    actorSeat: DEALER_SEAT,
    actorName: 'Dealer',
    action: 'deal',
    amount: 0,
    potBefore: 0,
    potAfter: state.pot,
    note: `Hand ${state.handId} dealt. Hero: ${hand.heroHoleCards.join(' ')}`
  });

  const blindSeats = [smallBlindSeat, bigBlindSeat];
  blindSeats.forEach((seat) => {
    const player = state.players[seat];
    const blindAmount = player.totalContributed;
    pushAction(hand, {
      timestamp,
      street: 'preflop',
      actorSeat: player.seat,
      actorName: player.name,
      action: 'post_blind',
      amount: blindAmount,
      toAmount: blindAmount,
      potBefore: seat === smallBlindSeat ? 0 : state.sb,
      potAfter: seat === smallBlindSeat ? state.sb : state.pot,
      stackBefore: player.stack + blindAmount,
      stackAfter: player.stack,
      note: seat === smallBlindSeat ? 'Small blind posted.' : 'Big blind posted.'
    });
  });

  return hand;
};

const recordStreetAdvance = (hand: SessionHandLog, previousState: GameState, nextState: GameState, timestamp: string) => {
  if (previousState.street === nextState.street) return;

  pushAction(hand, {
    timestamp,
    street: nextState.street,
    actorSeat: DEALER_SEAT,
    actorName: 'Dealer',
    action: 'street_advance',
    amount: 0,
    potBefore: previousState.pot,
    potAfter: nextState.pot,
    note: `Street advanced to ${nextState.street}.`
  });

  const newCards = nextState.board.slice(previousState.board.length);
  if (newCards.length === 0) return;

  if (nextState.street === 'flop') {
    hand.board.flop = cardsCode(newCards);
  }
  if (nextState.street === 'turn') {
    hand.board.turn = cardCode(newCards[0]);
  }
  if (nextState.street === 'river') {
    hand.board.river = cardCode(newCards[0]);
  }

  pushAction(hand, {
    timestamp,
    street: nextState.street,
    actorSeat: DEALER_SEAT,
    actorName: 'Dealer',
    action: 'deal',
    amount: 0,
    potBefore: previousState.pot,
    potAfter: nextState.pot,
    note: `Board: ${newCards.map(cardCode).join(' ')}`
  });
};

const finalizeHandLog = (hand: SessionHandLog, previousState: GameState, nextState: GameState, timestamp: string) => {
  if (nextState.street === 'showdown') {
    nextState.players
      .filter((player) => !player.folded)
      .forEach((player) => {
        hand.revealedHoleCards.push({
          seat: player.seat,
          name: player.name,
          cards: cardsCode(player.holeCards),
          reason: 'showdown'
        });
        pushAction(hand, {
          timestamp,
          street: 'showdown',
          actorSeat: player.seat,
          actorName: player.name,
          action: 'show',
          amount: 0,
          stackBefore: previousState.players[player.seat].stack,
          stackAfter: nextState.players[player.seat].stack,
          note: `Showed ${cardsCode(player.holeCards).join(' ')}`
        });
      });
  }

  const winners = nextState.players
    .filter((player) => player.stack > previousState.players[player.seat].stack)
    .map((player) => {
      const stackBefore = previousState.players[player.seat].stack;
      const amountWon = player.stack - stackBefore;

      pushAction(hand, {
        timestamp,
        street: nextState.street,
        actorSeat: player.seat,
        actorName: player.name,
        action: 'win',
        amount: amountWon,
        potBefore: previousState.pot,
        potAfter: nextState.pot,
        stackBefore,
        stackAfter: player.stack,
        note: amountWon > 0 ? `Won ${amountWon} chips.` : 'Awarded pot.'
      });

      return {
        seat: player.seat,
        name: player.name,
        amountWon,
        winningCards: !player.folded ? cardsCode(player.holeCards) : undefined
      };
    });

  nextState.players.forEach((player, index) => {
    if (previousState.players[index].stack > 0 && player.stack === 0) {
      hand.busts.push({
        seat: player.seat,
        name: player.name,
        timestamp,
        stackLost: previousState.players[index].stack
      });
      pushAction(hand, {
        timestamp,
        street: nextState.street,
        actorSeat: player.seat,
        actorName: player.name,
        action: 'bust',
        amount: previousState.players[index].stack,
        stackBefore: previousState.players[index].stack,
        stackAfter: player.stack,
        note: 'Player eliminated.'
      });
    }
  });

  hand.status = 'completed';
  hand.endedAt = timestamp;
  hand.endingStacks = stackMap(nextState.players);
  hand.result = {
    showdown: nextState.street === 'showdown',
    winnerSeats: winners.map((winner) => winner.seat),
    winners,
    heroInvolved: !nextState.players[HERO_SEAT].folded || hand.actions.some((action) => action.actorSeat === HERO_SEAT),
    heroWon: winners.some((winner) => winner.seat === HERO_SEAT),
    heroFoldStreet: heroFoldStreet(hand),
    heroResultChips: nextState.summary?.resultChips ?? null,
    heroResultBb: nextState.summary?.resultBb ?? null,
    potFinal: previousState.pot,
    rating: nextState.summary?.rating,
    feedback: nextState.summary?.feedback,
    why: nextState.summary?.why,
    tighter: nextState.summary?.tighter,
    aggressive: nextState.summary?.aggressive
  };

  if (nextState.summary?.feedback) {
    hand.notes.push(nextState.summary.feedback);
  }
};

export const createSessionRecord = (state: GameState, environment: SessionEnvironment): SessionRecord => {
  const timestamp = nowIso();
  return {
    formatVersion: SESSION_FORMAT_VERSION,
    app: 'Pocket Pixel Poker',
    session: {
      id: createId(),
      startedAt: timestamp,
      endedAt: null,
      mode: environment.mode,
      roomPolicy: environment.roomPolicy,
      pace: environment.pace,
      handsPlayed: 0,
      status: 'active'
    },
    table: {
      maxSeats: state.players.length,
      smallBlind: state.sb,
      bigBlind: state.bb,
      ante: 0,
      currency: 'chips',
      buttonStartSeat: state.dealer
    },
    players: state.players.map((player) => ({
      seat: player.seat,
      name: player.name,
      archetype: player.profile ?? (player.isHero ? 'Hero' : 'Regular'),
      isHero: player.isHero
    })),
    hands: [],
    sessionEvents: [{
      type: 'session_started',
      timestamp,
      note: 'Session created.'
    }]
  };
};

export const syncSessionEnvironment = (
  record: SessionRecord,
  state: GameState,
  environment: SessionEnvironment
): SessionRecord => {
  const nextRecord = clone(record);
  nextRecord.session.mode = environment.mode;
  nextRecord.session.roomPolicy = formatStrategyMode(environment.roomPolicy);
  nextRecord.session.pace = environment.pace;
  nextRecord.table.smallBlind = state.sb;
  nextRecord.table.bigBlind = state.bb;
  return nextRecord;
};

export const appendSessionEvent = (record: SessionRecord, type: SessionRecord['sessionEvents'][number]['type'], note?: string): SessionRecord => {
  const nextRecord = clone(record);
  nextRecord.sessionEvents.push({
    type,
    timestamp: nowIso(),
    note
  });
  return nextRecord;
};

export const completeSessionRecord = (record: SessionRecord): SessionRecord => {
  const nextRecord = clone(record);
  nextRecord.session.status = 'completed';
  nextRecord.session.endedAt = nowIso();
  return nextRecord;
};

export const recordStateTransition = (
  record: SessionRecord,
  previousState: GameState,
  nextState: GameState
): SessionRecord => {
  const timestamp = nowIso();
  const nextRecord = clone(record);

  if (nextState.handId > previousState.handId) {
    nextRecord.hands.push(createHandLog(nextState, timestamp));
  }

  const hand = ensureCurrentHand(nextRecord, nextState.handId);
  if (!hand) {
    nextRecord.session.handsPlayed = nextRecord.hands.filter((entry) => entry.status === 'completed').length;
    return nextRecord;
  }

  const latestAction = nextState.actions[nextState.actions.length - 1];
  if (latestAction && nextState.actions.length > previousState.actions.length) {
    const actorBefore = previousState.players[latestAction.seat];
    const actorAfter = nextState.players[latestAction.seat];
    pushAction(hand, {
      timestamp,
      street: latestAction.street,
      actorSeat: latestAction.seat,
      actorName: latestAction.playerName,
      action: latestAction.type,
      amount: latestAction.amount,
      toAmount: actorAfter.betThisStreet,
      potBefore: previousState.pot,
      potAfter: nextState.pot,
      stackBefore: actorBefore.stack,
      stackAfter: actorAfter.stack
    });
  }

  recordStreetAdvance(hand, previousState, nextState, timestamp);

  if (!previousState.summary && nextState.summary) {
    finalizeHandLog(hand, previousState, nextState, timestamp);
  }

  nextRecord.session.handsPlayed = nextRecord.hands.filter((entry) => entry.status === 'completed').length;
  nextRecord.table.buttonStartSeat ??= nextRecord.hands[0]?.buttonSeat ?? nextState.dealer;
  return nextRecord;
};

export const recordCoachHint = (
  record: SessionRecord,
  state: GameState,
  hint: { quick: string; detail: string }
): SessionRecord => {
  const nextRecord = clone(record);
  const hand = ensureCurrentHand(nextRecord, state.handId);
  if (!hand || hand.status !== 'active') return nextRecord;

  const timestamp = nowIso();
  const coachHint: SessionCoachHint = {
    timestamp,
    street: state.street,
    quick: hint.quick,
    detail: hint.detail
  };
  hand.coachHints.push(coachHint);
  pushAction(hand, {
    timestamp,
    street: state.street,
    actorSeat: DEALER_SEAT,
    actorName: 'Coach',
    action: 'coach_hint',
    amount: 0,
    potBefore: state.pot,
    potAfter: state.pot,
    note: hint.quick
  });
  return nextRecord;
};

export const createSessionExport = (record: SessionRecord): SessionExport => {
  const exportedAt = nowIso();
  return {
    ...clone(record),
    exportedAt,
    summary: deriveSummary(record)
  };
};
