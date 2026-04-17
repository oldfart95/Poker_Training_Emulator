import type { GameState } from '../engine/gameEngine';
import type { ActionRecord, Card, Player, Street } from '../engine/types';
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

const nowIso = () => new Date().toISOString();
const cardCode = (card: Card) => `${card.rank}${card.suit}`;
const cardsCode = (cards: Card[]) => cards.map(cardCode);
const clone = <T,>(value: T): T => structuredClone(value);
const formatStrategyMode = (mode: SessionEnvironment['roomPolicy']) => mode;

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ppp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const stackMap = (players: Player[]) => Object.fromEntries(players.map((player) => [String(player.seat), player.stack]));

const activePlayersAtStart = (state: GameState) => state.activeSeatsAtHandStart.map((seat) => {
  const player = state.players[seat];
  return {
    seat,
    name: player.name,
    position: player.position,
    isHero: player.isHero,
    stack: state.handStartStacks[String(seat)] ?? player.stack
  };
});

const heroFoldStreet = (hand: SessionHandLog): Street | null => {
  const fold = hand.actions.find((action) => action.actorSeat === HERO_SEAT && action.action === 'fold');
  return fold?.street ?? null;
};

const toSessionAction = (action: ActionRecord): SessionActionEvent => ({
  actionIndex: action.actionIndex,
  timestamp: action.timestamp,
  street: action.street,
  actorSeat: action.seat,
  actorName: action.playerName,
  action: action.type,
  amount: action.amount,
  toAmount: action.toAmount,
  potBefore: action.potBefore,
  potAfter: action.potAfter,
  stackBefore: action.stackBefore,
  stackAfter: action.stackAfter,
  amountToCallBefore: action.amountToCallBefore,
  amountToCallAfter: action.amountToCallAfter,
  isAllIn: action.isAllIn,
  legalActionsSnapshot: action.legalActionsSnapshot,
  note: action.note
});

const syncBoard = (hand: SessionHandLog, board: Card[]) => {
  hand.board.flop = board.slice(0, 3).map(cardCode);
  hand.board.turn = board[3] ? cardCode(board[3]) : null;
  hand.board.river = board[4] ? cardCode(board[4]) : null;
};

const deriveSummary = (record: SessionRecord): SessionSummary => {
  const completedHands = record.hands.filter((hand) => hand.status === 'completed');
  const heroPreflopInvolvement = completedHands.filter((hand) => hand.activePlayersAtStart.some((player) => player.seat === HERO_SEAT));
  const vpipCount = completedHands.filter((hand) => hand.actions.some((action) => (
    action.actorSeat === HERO_SEAT
    && action.street === 'preflop'
    && (action.action === 'call' || action.action === 'raise' || action.action === 'bet' || action.action === 'all_in')
  ))).length;
  const pfrCount = completedHands.filter((hand) => hand.actions.some((action) => (
    action.actorSeat === HERO_SEAT
    && action.street === 'preflop'
    && (action.action === 'raise' || action.action === 'bet' || action.action === 'all_in')
  ))).length;
  const wtsdCount = completedHands.filter((hand) => hand.result.showdown && hand.result.heroInvolved && !hand.result.heroFoldStreet).length;
  const aggressiveActions = completedHands.flatMap((hand) => hand.actions).filter((action) => (
    action.actorSeat === HERO_SEAT && (action.action === 'bet' || action.action === 'raise' || action.action === 'all_in')
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
  const hand: SessionHandLog = {
    handNumber: state.handId,
    handId: `${state.handId}-${createId()}`,
    status: 'active',
    startedAt: timestamp,
    endedAt: null,
    buttonSeat: state.dealer,
    smallBlindSeat: state.smallBlindSeat,
    bigBlindSeat: state.bigBlindSeat,
    activePlayersAtStart: activePlayersAtStart(state),
    startingStacks: { ...state.handStartStacks },
    heroHoleCards: cardsCode(state.players[HERO_SEAT]?.holeCards ?? []),
    revealedHoleCards: [],
    board: { flop: [], turn: null, river: null },
    actions: state.actions.map(toSessionAction),
    endingStacks: null,
    busts: [],
    coachHints: [],
    handIntegrity: state.handIntegrity,
    integrityErrors: [...state.integrityErrors],
    engineVersion: state.summary?.engineVersion ?? '2.0.0',
    tableSizeAtStart: state.activeSeatsAtHandStart.length,
    activeSeatMap: state.players.map((player) => state.activeSeatsAtHandStart.includes(player.seat)),
    result: {
      showdown: false,
      winnerSeats: [],
      winners: [],
      heroInvolved: state.activeSeatsAtHandStart.includes(HERO_SEAT),
      heroWon: false,
      heroFoldStreet: null,
      heroResultChips: null,
      heroResultBb: null,
      potFinal: null
    },
    notes: []
  };

  syncBoard(hand, state.board);
  return hand;
};

const finalizeHandLog = (hand: SessionHandLog, nextState: GameState, timestamp: string) => {
  const summary = nextState.summary;
  if (!summary) return;

  hand.status = 'completed';
  hand.endedAt = timestamp;
  hand.endingStacks = { ...summary.endingStacks };
  hand.busts = summary.busts.map((bust) => ({
    seat: bust.seat,
    name: bust.name,
    timestamp,
    stackLost: bust.stackLost
  }));
  hand.revealedHoleCards = summary.winners
    .filter((winner) => winner.winningCards)
    .map((winner) => ({
      seat: winner.seat,
      name: winner.name,
      cards: cardsCode(winner.winningCards ?? []),
      reason: 'showdown' as const
    }));
  hand.handIntegrity = summary.handIntegrity;
  hand.integrityErrors = [...summary.integrityErrors];
  hand.engineVersion = summary.engineVersion;
  hand.tableSizeAtStart = summary.tableSizeAtStart;
  hand.activeSeatMap = [...summary.activeSeatMap];
  hand.result = {
    showdown: summary.showdown,
    winnerSeats: summary.winners.map((winner) => winner.seat),
    winners: summary.winners.map((winner) => ({
      seat: winner.seat,
      name: winner.name,
      amountWon: winner.amountWon,
      winningCards: winner.winningCards ? cardsCode(winner.winningCards) : undefined
    })),
    heroInvolved: summary.activePlayersAtStart.includes(HERO_SEAT),
    heroWon: summary.winners.some((winner) => winner.seat === HERO_SEAT),
    heroFoldStreet: heroFoldStreet(hand),
    heroResultChips: summary.resultChips,
    heroResultBb: summary.resultBb,
    potFinal: summary.winners.reduce((sum, winner) => sum + winner.amountWon, 0),
    rating: summary.rating,
    feedback: summary.feedback,
    why: summary.why,
    tighter: summary.tighter,
    aggressive: summary.aggressive
  };
  if (summary.feedback) hand.notes.push(summary.feedback);
  if (summary.integrityErrors.length > 0) hand.notes.push(`Integrity: ${summary.integrityErrors.join(' | ')}`);
  syncBoard(hand, nextState.board);
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

  if (nextState.handId > previousState.handId && nextState.activeSeatsAtHandStart.length >= 2) {
    nextRecord.hands.push(createHandLog(nextState, timestamp));
  }

  const hand = ensureCurrentHand(nextRecord, nextState.handId);
  if (!hand) {
    nextRecord.session.handsPlayed = nextRecord.hands.filter((entry) => entry.status === 'completed').length;
    return nextRecord;
  }

  if (nextState.actions.length > hand.actions.length) {
    hand.actions.push(...nextState.actions.slice(hand.actions.length).map(toSessionAction));
  }

  syncBoard(hand, nextState.board);

  if (!previousState.summary && nextState.summary) {
    finalizeHandLog(hand, nextState, timestamp);
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
  hand.actions.push({
    actionIndex: hand.actions.length,
    timestamp,
    street: state.street,
    actorSeat: -1,
    actorName: 'Coach',
    action: 'coach_hint',
    amount: 0,
    toAmount: 0,
    potBefore: state.pot,
    potAfter: state.pot,
    stackBefore: 0,
    stackAfter: 0,
    amountToCallBefore: 0,
    amountToCallAfter: 0,
    isAllIn: false,
    note: hint.quick
  });
  return nextRecord;
};

export const createSessionExport = (record: SessionRecord): SessionExport => ({
  ...clone(record),
  exportedAt: nowIso(),
  summary: deriveSummary(record)
});
