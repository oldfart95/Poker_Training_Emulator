import { botDecision } from '../ai/botLogic';
import { botProfiles } from '../ai/botProfiles';
import { compareHands, evaluateBestHand } from './handEvaluator';
import { createDeck, shuffleDeck } from './deck';
import { ActionRecord, Card, HandSummary, Player, SessionStats, Street } from './types';
import { rateHand } from '../training/coach';

export interface GameState {
  handId: number;
  players: Player[];
  board: Card[];
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
  stats: SessionStats;
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
    name: seat === 0 ? 'Hero' : botProfiles[seat - 1].name,
    isHero: seat === 0,
    stack: 10000,
    holeCards: [],
    folded: false,
    allIn: false,
    betThisStreet: 0,
    totalContributed: 0,
    seat,
    position: '',
    profile: seat === 0 ? undefined : botProfiles[seat - 1].name
  }));

  return {
    handId: 0,
    players,
    board: [],
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
    stats: initialStats()
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
  s.dealer = (s.dealer + 1) % s.players.length;
  s.street = 'preflop'; s.board = []; s.actions = []; s.pot = 0; s.currentBet = s.bb;
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
  if (s.street === 'preflop') { s.street = 'flop'; s.board.push(s.deck.pop()!, s.deck.pop()!, s.deck.pop()!); }
  else if (s.street === 'flop') { s.street = 'turn'; s.board.push(s.deck.pop()!); }
  else if (s.street === 'turn') { s.street = 'river'; s.board.push(s.deck.pop()!); }
  else { s.street = 'showdown'; }
  resetStreetBets(s);
  s.lastAggressor = -1;
  s.currentSeat = nextActiveSeat(s, s.dealer);
};

const allMatched = (s: GameState): boolean => s.players.every((p) => p.folded || p.allIn || p.betThisStreet === s.currentBet);

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

  const hero = s.players[0];
  const delta = hero.stack - 10000;
  const recap = rateHand(hero, s.board, s.actions, delta, s.bb);
  s.summary = { id: s.handId, heroCards: hero.holeCards, heroPosition: hero.position, board: [...s.board], actions: [...s.actions], resultChips: delta, resultBb: delta/s.bb, ...recap };
  s.stats.winLossBb += delta / s.bb;
  s.stats.biggestWinBb = Math.max(s.stats.biggestWinBb, delta/s.bb);
  s.stats.biggestPuntBb = Math.min(s.stats.biggestPuntBb, delta/s.bb);
  if (!hero.folded) s.stats.wtsdCount += 1;
  return s;
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
    alive(s)[0].stack += s.pot;
    return showdown(s);
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

export const runBotsUntilHero = (state: GameState): GameState => {
  let s = structuredClone(state);
  while (!s.waitingForHero && !s.summary) {
    const seat = s.currentSeat;
    const p = s.players[seat];
    const profile = botProfiles.find((b) => b.name === p.profile)!;
    const legal = legalActions(s, seat);
    const action = botDecision({
      profile,
      cards: p.holeCards,
      board: s.board,
      street: s.street,
      toCall: legal.toCall,
      pot: s.pot,
      minRaise: legal.minRaise,
      stack: p.stack,
      canCheck: legal.canCheck,
      positionIndex: ['UTG','HJ','CO','BTN','SB','BB'].indexOf(p.position),
      wasRaised: s.currentBet > s.bb || s.actions.some((a) => a.street === 'preflop' && (a.type === 'raise' || a.type === 'all-in'))
    });
    s = applyAction(s, seat, action.type, action.amount);
  }
  return s;
};
