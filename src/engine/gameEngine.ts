import { decideBotAction, DecisionDebug } from '../ai/decision';
import { botArchetypes } from '../ai/botProfiles';
import { compareHands, evaluateBestHand } from './handEvaluator';
import { createDeck, shuffleDeck } from './deck';
import { ActionRecord, Card, HandSummary, Player, SessionStats, Street } from './types';
import { rateHand } from '../training/coach';
import { Position } from '../ai/tuning/ranges';
import { Archetype } from '../ai/tuning/archetypes';
import { StrategyMode } from '../strategy/types';

export interface GameState {
  handId: number;
  players: Player[];
  board: Card[];
  previousBoard: Card[];
  deck: Card[];
  pot: number;
  dealer: number;
  sb: number;
  bb: number;
  currentBet: number;
  currentSeat: number;
  street: Street;
  actions: ActionRecord[];
  lastAggressor: number;
  waitingForHero: boolean;
  summary?: HandSummary;
  heroStackAtHandStart: number;
  handStartingPot: number;
  stats: SessionStats;
  botDebug?: DecisionDebug;
  strategyMode: StrategyMode;
}

export const initialStats = (): SessionStats => ({
  hands: 0, vpipOpportunities: 0, vpipCount: 0, pfrOpportunities: 0, pfrCount: 0,
  threeBetOpportunities: 0, threeBetCount: 0, foldToThreeBetOpportunities: 0, foldToThreeBetCount: 0,
  cBetOpportunities: 0, cBetCount: 0, wtsdCount: 0, biggestWinBb: 0, biggestPuntBb: 0, winLossBb: 0,
  mistakes: { 'too loose preflop': 0, 'passive error': 0, 'bad call': 0, 'bad bluff': 0, 'overvalue hand': 0 }
});

const POS = ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'];

export const createInitialState = (): GameState => {
  const players: Player[] = Array.from({ length: 6 }, (_, seat) => ({
    id: `p${seat}`,
    name: seat === 0 ? 'Hero' : botArchetypes[seat - 1],
    isHero: seat === 0,
    stack: 10000,
    holeCards: [],
    folded: false,
    allIn: false,
    betThisStreet: 0,
    totalContributed: 0,
    seat,
    position: '',
    profile: seat === 0 ? undefined : botArchetypes[seat - 1]
  }));

  return {
    handId: 0,
    players,
    board: [],
    previousBoard: [],
    deck: [],
    pot: 0,
    dealer: 0,
    sb: 50,
    bb: 100,
    currentBet: 0,
    currentSeat: 0,
    street: 'preflop',
    actions: [],
    lastAggressor: -1,
    waitingForHero: false,
    heroStackAtHandStart: 10000,
    handStartingPot: 0,
    stats: initialStats(),
    botDebug: undefined,
    strategyMode: 'exploit'
  };
};

const nextActiveSeat = (state: GameState, from: number): number => {
  for (let i = 1; i <= state.players.length; i++) {
    const idx = (from + i) % state.players.length;
    const p = state.players[idx];
    if (!p.folded && !p.allIn && p.stack > 0) return idx;
  }
  return from;
};

const alive = (state: GameState) => state.players.filter((p) => !p.folded);

export const beginHand = (state: GameState): GameState => {
  const s: GameState = structuredClone(state);
  s.handId += 1;
  s.heroStackAtHandStart = s.players[0].stack;
  s.dealer = (s.dealer + 1) % s.players.length;
  s.street = 'preflop'; s.board = []; s.previousBoard = []; s.actions = []; s.pot = 0; s.currentBet = s.bb;
  s.deck = shuffleDeck(createDeck());
  s.summary = undefined;

  s.players.forEach((p) => {
    p.holeCards = [s.deck.pop()!, s.deck.pop()!];
    p.folded = p.stack <= 0;
    p.allIn = false;
    p.betThisStreet = 0;
    p.totalContributed = 0;
    const rel = (p.seat - s.dealer + 6) % 6;
    p.position = POS[rel];
  });

  const sbSeat = (s.dealer + 1) % 6;
  const bbSeat = (s.dealer + 2) % 6;
  postBlind(s, sbSeat, s.sb);
  postBlind(s, bbSeat, s.bb);
  s.handStartingPot = s.pot;
  s.currentSeat = nextActiveSeat(s, bbSeat);
  s.waitingForHero = s.currentSeat === 0;
  s.stats.hands += 1;
  s.stats.vpipOpportunities += 1;
  s.stats.pfrOpportunities += 1;
  return s;
};

const postBlind = (s: GameState, seat: number, amount: number) => {
  const p = s.players[seat];
  const paid = Math.min(amount, p.stack);
  p.stack -= paid; p.betThisStreet += paid; p.totalContributed += paid;
  s.pot += paid;
};

const resetStreetBets = (s: GameState) => {
  s.players.forEach((p) => p.betThisStreet = 0);
  s.currentBet = 0;
};

const moveStreet = (s: GameState) => {
  s.previousBoard = [...s.board];
  if (s.street === 'preflop') { s.street = 'flop'; s.board.push(s.deck.pop()!, s.deck.pop()!, s.deck.pop()!); }
  else if (s.street === 'flop') { s.street = 'turn'; s.board.push(s.deck.pop()!); }
  else if (s.street === 'turn') { s.street = 'river'; s.board.push(s.deck.pop()!); }
  else { s.street = 'showdown'; }
  resetStreetBets(s);
  s.lastAggressor = -1;
  s.currentSeat = nextActiveSeat(s, s.dealer);
};

const allMatched = (s: GameState): boolean => s.players.every((p) => p.folded || p.allIn || p.betThisStreet === s.currentBet);

const finalizeHand = (s: GameState, reachedShowdown: boolean): GameState => {
  const hero = s.players[0];
  const delta = hero.stack - s.heroStackAtHandStart;
  const recap = rateHand(hero, s.board, s.actions, delta, s.bb, s.players);
  s.summary = {
    id: s.handId,
    heroCards: hero.holeCards,
    heroPosition: hero.position,
    board: [...s.board],
    actions: [...s.actions],
    startingPot: s.handStartingPot,
    sb: s.sb,
    bb: s.bb,
    resultChips: delta,
    resultBb: delta / s.bb,
    ...recap
  };
  s.stats.winLossBb += delta / s.bb;
  s.stats.biggestWinBb = Math.max(s.stats.biggestWinBb, delta/s.bb);
  s.stats.biggestPuntBb = Math.min(s.stats.biggestPuntBb, delta/s.bb);
  if (reachedShowdown && !hero.folded) s.stats.wtsdCount += 1;
  s.pot = 0;
  return s;
};

const showdown = (s: GameState): GameState => {
  const survivors = s.players.filter((p) => !p.folded);
  let best = evaluateBestHand([...survivors[0].holeCards, ...s.board]);
  let winners = [survivors[0]];
  survivors.slice(1).forEach((p) => {
    const h = evaluateBestHand([...p.holeCards, ...s.board]);
    const cmp = compareHands(h, best);
    if (cmp > 0) { best = h; winners = [p]; }
    else if (cmp === 0) winners.push(p);
  });
  const share = Math.floor(s.pot / winners.length);
  winners.forEach((w) => w.stack += share);

  return finalizeHand(s, true);
};

const awardFoldOut = (s: GameState): GameState => {
  const winner = alive(s)[0];
  winner.stack += s.pot;
  return finalizeHand(s, false);
};

export const legalActions = (s: GameState, seat: number) => {
  const p = s.players[seat];
  const toCall = Math.max(0, s.currentBet - p.betThisStreet);
  const minRaise = s.currentBet === 0 ? s.bb : s.currentBet * 2;
  return { toCall, minRaise, canCheck: toCall === 0, max: p.stack };
};

export const applyAction = (state: GameState, seat: number, type: 'fold'|'check'|'call'|'raise'|'all-in', amount = 0): GameState => {
  const s: GameState = structuredClone(state);
  const p = s.players[seat];
  const { toCall } = legalActions(s, seat);
  let committed = 0;

  if (type === 'fold') p.folded = true;
  if (type === 'call') committed = Math.min(toCall, p.stack);
  if (type === 'raise') committed = Math.min(p.stack, amount);
  if (type === 'all-in') committed = p.stack;

  if (committed > 0) {
    p.stack -= committed;
    p.betThisStreet += committed;
    p.totalContributed += committed;
    s.pot += committed;
  }

  if (p.stack === 0) p.allIn = true;
  if (type === 'raise' || (type === 'all-in' && p.betThisStreet > s.currentBet)) {
    s.currentBet = p.betThisStreet;
    s.lastAggressor = seat;
  }

  s.actions.push({ seat, playerName: p.name, street: s.street, type: type === 'all-in' ? 'all-in' : type, amount: committed });

  if (seat === 0 && s.street === 'preflop' && ['call','raise','all-in'].includes(type)) s.stats.vpipCount += 1;
  if (seat === 0 && s.street === 'preflop' && ['raise','all-in'].includes(type)) s.stats.pfrCount += 1;

  if (alive(s).length === 1) {
    return awardFoldOut(s);
  }

  const next = nextActiveSeat(s, seat);
  if (allMatched(s) && next === nextActiveSeat(s, s.lastAggressor === -1 ? s.dealer : s.lastAggressor)) {
    moveStreet(s);
    if (s.street === 'showdown') return showdown(s);
  } else {
    s.currentSeat = next;
  }

  s.waitingForHero = s.currentSeat === 0;
  return s;
};

export const runBotsUntilHero = (state: GameState, strategyMode: StrategyMode = state.strategyMode): GameState => {
  let s = structuredClone(state);
  s.strategyMode = strategyMode;
  while (!s.waitingForHero && !s.summary) {
    const seat = s.currentSeat;
    const p = s.players[seat];
    const legal = legalActions(s, seat);
    const decision = decideBotAction({
      archetype: p.profile as Archetype,
      cards: p.holeCards,
      board: s.board,
      previousBoard: s.previousBoard,
      street: s.street,
      toCall: legal.toCall,
      pot: s.pot,
      minRaise: legal.minRaise,
      stack: p.stack,
      canCheck: legal.canCheck,
      position: p.position as Position,
      playersInHand: alive(s).length,
      wasPreflopAggressor: s.actions.some((a) => a.street === 'preflop' && a.seat === seat && (a.type === 'raise' || a.type === 'all-in')),
      facingThreeBet: s.street === 'preflop' && s.actions.filter((a) => (a.type === 'raise' || a.type === 'all-in') && a.street === 'preflop').length >= 2,
      hasBetThisStreet: s.actions.some((a) => a.seat === seat && a.street === s.street && (a.type === 'raise' || a.type === 'all-in' || a.type === 'bet')),
      strategyMode
    });
    s.botDebug = decision.debug;
    s = applyAction(s, seat, decision.type, decision.amount);
  }
  return s;
};
